// services/paymentService.js
import { randomUUID } from 'crypto';
import { supabase } from './supabase.js';
import { normalizeBookingTable } from './tableCapacity.js';

const SLIP_BUCKET =
  process.env.SLIP_BUCKET ||
  process.env.SUPABASE_PAYMENTS_BUCKET ||
  'payment-slips';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function sanitizePathSegment(value) {
  if (!value || typeof value !== 'string') {
    return 'unknown';
  }

  const trimmed = value.trim();
  return trimmed.replace(/[^a-zA-Z0-9\-_.]/g, '-').slice(0, 48) || 'unknown';
}

export function isDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl || '');

  if (!match) {
    throw new Error('INVALID_DATA_URL');
  }

  const [, mimeType, base64Payload] = match;
  const buffer = Buffer.from(base64Payload, 'base64');

  if (!buffer.length) {
    throw new Error('EMPTY_SLIP_DATA');
  }

  const extension = (mimeType?.split('/')?.[1] || 'png').split('+')[0];

  return { buffer, mimeType, extension };
}

function buildSlipStoragePath({ bookingId, userId, extension }) {
  const bookingSegment = sanitizePathSegment(bookingId || 'booking');
  const userSegment = sanitizePathSegment(userId || 'user');
  const fileName = `${Date.now()}-${randomUUID()}.${extension}`;

  return `${userSegment}/${bookingSegment}/${fileName}`;
}

function extractStoragePathFromUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  const bucketSegment = `/${SLIP_BUCKET}/`;
  const index = url.indexOf(bucketSegment);

  if (index === -1) {
    return null;
  }

  return url.slice(index + bucketSegment.length).split('?')[0];
}

export async function deleteSlipByPublicUrl(url) {
  const storagePath = extractStoragePathFromUrl(url);

  if (!storagePath) {
    return;
  }

  const { error } = await supabase.storage
    .from(SLIP_BUCKET)
    .remove([storagePath]);

  if (error && error.status !== 404) {
    console.warn('REMOVE_SLIP_ERROR:', error, { storagePath });
  }
}

export async function storePaymentSlipFromDataUrl({ dataUrl, bookingId, userId, previousUrl }) {
  if (!isDataUrl(dataUrl)) {
    throw new Error('INVALID_DATA_URL');
  }

  const { buffer, mimeType, extension } = parseDataUrl(dataUrl);
  const storagePath = buildSlipStoragePath({ bookingId, userId, extension });

  const { error: uploadError } = await supabase.storage
    .from(SLIP_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: publicUrlData } = supabase.storage
    .from(SLIP_BUCKET)
    .getPublicUrl(storagePath);

  const publicUrl = publicUrlData?.publicUrl || `${SUPABASE_URL}/storage/v1/object/public/${SLIP_BUCKET}/${storagePath}`;

  if (previousUrl) {
    await deleteSlipByPublicUrl(previousUrl).catch(error => {
      console.warn('REMOVE_PREVIOUS_SLIP_WARNING:', error);
    });
  }

  return { storagePath, publicUrl };
}

function isValidUuid(value) {
  if (typeof value !== 'string') {
    return false;
  }

  return UUID_REGEX.test(value.trim());
}

function isUuidCastError(error) {
  if (!error) return false;

  const code = error.code || error.status || error.statusCode;
  if (code === '22P02') {
    return true;
  }

  const message = (error.message || '').toLowerCase();
  return message.includes('invalid input syntax for type uuid');
}

/**
 * ดึงรายการ payments ทั้งหมด (พร้อม filters และ pagination)
 */
export async function getAllPayments({
  status,
  paymentType,
  search,
  page = 1,
  limit = 20,
  sortBy = 'created_at',
  sortOrder = 'desc'
}) {
  try {
    let query = supabase
      .from('payments')
      .select(`
        *,
        booking:bookings!payments_booking_id_fkey(
          id,
          status,
          booking_date,
          start_time,
          end_time,
          number_of_people,
          total_amount,
          deposit_amount,
          remaining_amount,
          payment_type,
          table:tables!bookings_table_id_fkey(
            id,
            table_number,
            description,
            category:room_categories!tables_category_id_fkey(*)
          )
        ),
        user:bookings!payments_booking_id_fkey(
          user:users!bookings_user_id_fkey(id, email, full_name, phone)
        )
      `, { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' });

    query = query.neq('booking.status', 'cancelled');

    // Filter by payment status
    if (status && status !== 'all') {
      query = query.eq('payment_status', status);
    }

    // Filter by payment type
    if (paymentType && paymentType !== 'all') {
      query = query.eq('payment_type', paymentType);
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('SUPABASE_ERROR:', error);
      throw error;
    }

    // ⭐ ปรับ structure ให้ง่ายต่อการใช้งาน
    const payments = (data || [])
      .map(payment => ({
        ...payment,
        booking: normalizeBookingTable(payment.booking),
        user: payment.user?.user || null
      }))
      .filter(payment => payment.booking?.status !== 'cancelled');

    // ⭐ Search logic - filter ด้วย JS เพราะ Supabase ไม่สามารถ search nested field ได้โดยตรง
    let filteredPayments = payments;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filteredPayments = payments.filter(payment => {
        const user = payment.user;
        if (!user) return false;
        
        const fullName = (user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = (user.phone || '').toLowerCase();
        const transactionRef = (payment.transaction_ref || '').toLowerCase();
        
        return fullName.includes(searchLower) || 
               email.includes(searchLower) || 
               phone.includes(searchLower) ||
               transactionRef.includes(searchLower);
      });
    }

    return {
      payments: filteredPayments,
      pagination: {
        page,
        limit,
        total: search ? filteredPayments.length : (count ?? filteredPayments.length),
        totalPages: Math.ceil((search ? filteredPayments.length : (count ?? filteredPayments.length)) / limit)
      }
    };
  } catch (error) {
    console.error('GET_ALL_PAYMENTS_ERROR:', error);
    throw error;
  }
}

/**
 * ดึงรายการชำระเงินของผู้ใช้ที่กำหนด
 */
export async function getPaymentsForUser(userId, {
  status,
  page = 1,
  limit = 10
} = {}) {
  if (!userId) {
    throw new Error('USER_ID_REQUIRED');
  }

  try {
    let query = supabase
      .from('payments')
      .select(`
        *,
        booking:bookings!inner(
          id,
          booking_date,
          start_time,
          end_time,
          status,
          payment_status,
          total_amount,
          deposit_amount,
          remaining_amount,
          payment_type,
          table:tables!bookings_table_id_fkey(
            id,
            table_number,
            description,
            category:room_categories!tables_category_id_fkey(*)
          )
        )
      `, { count: 'exact' })
      .eq('booking.user_id', userId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('payment_status', status);
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('GET_USER_PAYMENTS_SUPABASE_ERROR:', error);
      throw error;
    }

    const payments = (data || []).map(payment => ({
      ...payment,
      booking: normalizeBookingTable(payment.booking)
    }));

    return {
      payments,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error) {
    console.error('GET_USER_PAYMENTS_ERROR:', error);
    throw error;
  }
}

/**
 * ⭐ ยืนยันการชำระเงิน (verify slip) + ลดสต็อก
 */
export async function verifyPayment(id, verifiedBy) {
  try {
    console.log('🔍 Starting payment verification for ID:', id);

    // 1. ดึงข้อมูล payment
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        booking:bookings!payments_booking_id_fkey(
          id,
          booking_date,
          table:tables!bookings_table_id_fkey(table_number)
        )
      `)
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    if (!payment) {
      throw { code: 'NOT_FOUND', message: 'Payment not found' };
    }

    console.log('📄 Payment details:', {
      transaction_ref: payment.transaction_ref,
      amount: payment.amount,
      payment_type: payment.payment_type
    });

    // 2. ✅ ตรวจสอบว่าเป็น Food Order หรือไม่
    const isFoodOrder = payment.transaction_ref && payment.transaction_ref.startsWith('FOOD-');

    // 3. ถ้าเป็น Food Order → ลดสต็อก
    if (isFoodOrder) {
      console.log('🍽️ This is a Food Order - reducing stock...');
      await reduceStockForFoodOrder(payment.transaction_ref);
    } else {
      console.log('🏠 This is a Booking payment - no stock update needed');
    }

    // 4. อัพเดทสถานะ payment เป็น verified
    const { data: updatedPayment, error: updateError } = await supabase
      .from('payments')
      .update({
        payment_status: 'verified',
        verified_by: verifiedBy,
        verified_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        *,
        booking:bookings!payments_booking_id_fkey(
          id,
          booking_date,
          table:tables!bookings_table_id_fkey(table_number)
        )
      `)
      .single();

    if (updateError) throw updateError;

    // 5. อัพเดทสถานะ payment ใน bookings table
    if (updatedPayment) {
      await updateBookingPaymentStatus(updatedPayment.booking_id, updatedPayment.payment_type);
    }

    console.log('✅ Payment verification completed successfully');
    return updatedPayment;
  } catch (error) {
    console.error('❌ VERIFY_PAYMENT_ERROR:', error);
    throw error;
  }
}

/**
 * ⭐ ฟังก์ชันใหม่: ลดสต็อกสำหรับ Food Order
 */
async function reduceStockForFoodOrder(transactionRef) {
  try {
    console.log('🔄 Starting stock reduction for:', transactionRef);

    // 1. ดึง order_number จาก transaction_ref (FOOD-FO-xxxxx-xxxxxx)
    const orderNumber = transactionRef.replace('FOOD-', '');
    console.log('📝 Looking for order number:', orderNumber);

    // 2. ค้นหา food_order
    const { data: foodOrder, error: orderError } = await supabase
      .from('food_orders')
      .select('id, order_number, status')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (orderError) throw orderError;

    if (!foodOrder) {
      console.warn('⚠️ Food order not found for:', transactionRef);
      return;
    }

    console.log('📦 Food order found:', foodOrder.id);

    // 3. ดึงรายการอาหารใน order
    const { data: orderItems, error: itemsError } = await supabase
      .from('food_order_items')
      .select('menu_item_id, quantity, menu_item:menu_items(name, stock_quantity)')
      .eq('food_order_id', foodOrder.id);

    if (itemsError) throw itemsError;

    if (!orderItems || orderItems.length === 0) {
      console.warn('⚠️ No items found in food order:', foodOrder.id);
      return;
    }

    console.log(`🍽️ Found ${orderItems.length} items to process`);

    // 4. ลดสต็อกของแต่ละเมนู
    for (const item of orderItems) {
      try {
        // ดึงสต็อกปัจจุบัน
        const { data: menuItem, error: fetchError } = await supabase
          .from('menu_items')
          .select('stock_quantity, name')
          .eq('id', item.menu_item_id)
          .single();

        if (fetchError) {
          console.error('❌ Failed to fetch menu item:', item.menu_item_id, fetchError);
          continue;
        }

        const currentStock = menuItem.stock_quantity || 0;
        const newStock = Math.max(currentStock - item.quantity, 0);

        console.log(`📊 ${menuItem.name}: ${currentStock} → ${newStock} (-${item.quantity})`);

        // อัพเดทสต็อก
        const { error: stockError } = await supabase
          .from('menu_items')
          .update({ 
            stock_quantity: newStock,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.menu_item_id);

        if (stockError) {
          console.error('❌ Failed to update stock for:', menuItem.name, stockError);
        } else {
          console.log(`✅ Stock updated for: ${menuItem.name}`);
        }
      } catch (itemError) {
        console.error('❌ Error processing item:', item.menu_item_id, itemError);
        // ไม่ throw error เพื่อให้ดำเนินการต่อกับ item อื่นๆ
      }
    }

    // 5. อัพเดทสถานะ food_order เป็น 'paid'
    const { error: orderUpdateError } = await supabase
      .from('food_orders')
      .update({ 
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', foodOrder.id);

    if (orderUpdateError) {
      console.error('⚠️ Failed to update food order status:', orderUpdateError);
    } else {
      console.log('✅ Food order status updated to: paid');
    }

    console.log('✅ Stock reduction completed successfully for:', transactionRef);
  } catch (error) {
    console.error('❌ REDUCE_STOCK_ERROR:', error);
    // ไม่ throw error เพื่อไม่ให้ verify payment ล้มเหลว
    // แค่ log error ไว้เพื่อ debug
  }
}

/**
 * ปฏิเสธการชำระเงิน
 */
export async function rejectPayment(id, reason) {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('payments')
      .update({
        payment_status: 'rejected',
        rejection_reason: reason,
        verified_by: null,
        verified_at: null,
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('REJECT_PAYMENT_ERROR:', error);
    throw error;
  }
}

/**
 * สถิติ payments
 */
export async function getPaymentStats() {
  try {
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        payment_status,
        amount,
        payment_type,
        created_at,
        booking:bookings!payments_booking_id_fkey(status)
      `);

    if (error) throw error;

    const activePayments = (payments || []).filter(p => p.booking?.status !== 'cancelled');

    const stats = {
      total: activePayments.length,
      byStatus: {
        pending: activePayments.filter(p => p.payment_status === 'pending').length,
        verified: activePayments.filter(p => p.payment_status === 'verified').length,
        rejected: activePayments.filter(p => p.payment_status === 'rejected').length
      },
      byType: {
        deposit: activePayments.filter(p => p.payment_type === 'deposit').length,
        remaining: activePayments.filter(p => p.payment_type === 'remaining').length,
        full_payment: activePayments.filter(p => p.payment_type === 'full_payment').length
      },
      totalAmount: activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
      verifiedAmount: activePayments
        .filter(p => p.payment_status === 'verified')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0)
    };

    // ยอดวันนี้
    const today = new Date().toISOString().split('T')[0];
    stats.today = activePayments.filter(p =>
      p.created_at.startsWith(today)
    ).length;

    return stats;
  } catch (error) {
    console.error('GET_PAYMENT_STATS_ERROR:', error);
    throw error;
  }
}

/**
 * Helper: อัพเดทสถานะการชำระเงินใน bookings table
 */
async function updateBookingPaymentStatus(bookingId, paymentType) {
  try {
    let updates = {};

    if (paymentType === 'deposit') {
      updates = {
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        payment_status: 'deposit_paid'
      };
    } else if (paymentType === 'remaining') {
      updates = {
        remaining_paid: true,
        remaining_paid_at: new Date().toISOString(),
        payment_status: 'paid'
      };
    } else if (paymentType === 'full_payment') {
      updates = {
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        remaining_paid: true,
        remaining_paid_at: new Date().toISOString(),
        payment_status: 'paid'
      };
    }

    const { error } = await supabase
      .from('bookings')
      .update(updates)
      .eq('id', bookingId);

    if (error) {
      console.error('UPDATE_BOOKING_PAYMENT_STATUS_ERROR:', error);
    }
  } catch (error) {
    console.error('UPDATE_BOOKING_PAYMENT_STATUS_ERROR:', error);
  }
}

/**
 * สร้าง payment record ใหม่ (เมื่อ user อัพโหลด slip)
 */
export async function createPayment(paymentData) {
  try {
    let slipImageUrl = paymentData.slip_image_url || null;

    if (slipImageUrl && isDataUrl(slipImageUrl)) {
      const { publicUrl } = await storePaymentSlipFromDataUrl({
        dataUrl: slipImageUrl,
        bookingId: paymentData.booking_id,
        userId: paymentData.user_id
      });

      slipImageUrl = publicUrl;
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        booking_id: paymentData.booking_id,
        payment_type: paymentData.payment_type,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method || 'bank_transfer',
        payment_status: 'pending',
        slip_image_url: slipImageUrl,
        transaction_ref: paymentData.transaction_ref
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('CREATE_PAYMENT_ERROR:', error);
    throw error;
  }
}

export async function getPaymentById(id, options = {}) {
  const bookingIdInput = options.bookingId;
  const expectedPaymentType = options.paymentType;

  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const normalizedBookingId =
    typeof bookingIdInput === 'string' ? bookingIdInput.trim() : '';

  const canLookupById = isValidUuid(normalizedId);
  const canLookupByBooking = isValidUuid(normalizedBookingId);

  if (!canLookupById && !canLookupByBooking) {
    return null;
  }

  try {
    let paymentRow = null;

    if (canLookupById) {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('id', normalizedId)
        .maybeSingle();

      if (error) {
        if (!canLookupByBooking || !isUuidCastError(error)) {
          throw error;
        }

        console.warn('GET_PAYMENT_BY_ID_FALLBACK:', {
          paymentId: normalizedId,
          bookingId: normalizedBookingId || null,
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else {
        paymentRow = data;
      }
    }

    if (!paymentRow && canLookupByBooking) {
      let bookingQuery = supabase
        .from('payments')
        .select('*')
        .eq('booking_id', normalizedBookingId);

      if (expectedPaymentType) {
        bookingQuery = bookingQuery.eq('payment_type', expectedPaymentType);
      }

      const { data, error } = await bookingQuery
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      paymentRow = data;
    }

    if (!paymentRow) {
      return null;
    }

    let booking = null;

    if (paymentRow.booking_id) {
      if (isValidUuid(paymentRow.booking_id)) {
        const { data: bookingRow, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            table:tables!bookings_table_id_fkey(
              id,
              table_number,
              description,
              category:room_categories!tables_category_id_fkey(*)
            )
          `)
          .eq('id', paymentRow.booking_id)
          .maybeSingle();

        if (bookingError) {
          console.warn('GET_PAYMENT_BOOKING_WARNING:', bookingError, {
            paymentId: normalizedId || paymentRow.id,
            bookingId: paymentRow.booking_id
          });
        } else if (bookingRow) {
          booking = normalizeBookingTable(bookingRow);
        }
      } else {
        console.warn('PAYMENT_BOOKING_ID_INVALID:', {
          paymentId: normalizedId || paymentRow.id,
          bookingId: paymentRow.booking_id
        });
      }
    }

    return {
      ...paymentRow,
      booking
    };
  } catch (error) {
    console.error('GET_PAYMENT_BY_ID_ERROR:', error);
    throw error;
  }
}

export async function updatePayment(id, updates = {}, options = {}) {
  const bookingIdInput = options.bookingId;
  const expectedPaymentType = options.paymentType;
  const userIdForStorage = options.userId;
  const previousSlipUrl = options.currentSlipUrl;

  const normalizedId = typeof id === 'string' ? id.trim() : '';
  const normalizedBookingId =
    typeof bookingIdInput === 'string' ? bookingIdInput.trim() : '';

  const canUpdateById = isValidUuid(normalizedId);
  const canFallbackByBooking = isValidUuid(normalizedBookingId);
  const fallbackBookingIdForStorage =
    normalizedBookingId || updates.booking_id || options.bookingId || null;

  if (!canUpdateById && !canFallbackByBooking) {
    throw new Error('PAYMENT_ID_REQUIRED');
  }

  const payload = {
    updated_at: new Date().toISOString(),
    payment_status: 'pending',
    verified_by: null,
    verified_at: null,
    rejection_reason: null
  };

  if (updates.amount !== undefined && updates.amount !== null) {
    const numericAmount = Number(updates.amount);
    if (Number.isFinite(numericAmount)) {
      payload.amount = numericAmount;
    }
  }

  if (updates.payment_method) {
    payload.payment_method = updates.payment_method;
  }

  if (updates.transaction_ref) {
    payload.transaction_ref = updates.transaction_ref;
  }

  if (updates.slip_image_url) {
    if (isDataUrl(updates.slip_image_url)) {
      const { publicUrl } = await storePaymentSlipFromDataUrl({
        dataUrl: updates.slip_image_url,
        bookingId: fallbackBookingIdForStorage,
        userId: userIdForStorage,
        previousUrl: previousSlipUrl
      });

      payload.slip_image_url = publicUrl;
    } else {
      payload.slip_image_url = updates.slip_image_url;
    }
  }

  try {
    if (canUpdateById) {
      const { data, error } = await supabase
        .from('payments')
        .update(payload)
        .eq('id', normalizedId)
        .select()
        .single();

      if (!error && data) {
        return data;
      }

      if (error) {
        if (!canFallbackByBooking || !isUuidCastError(error)) {
          throw error;
        }

        console.warn('UPDATE_PAYMENT_FALLBACK:', {
          paymentId: normalizedId,
          bookingId: normalizedBookingId || null,
          error: {
            code: error.code,
            message: error.message
          }
        });
      } else if (!canFallbackByBooking) {
        return null;
      } else {
        console.warn('UPDATE_PAYMENT_FALLBACK:', {
          paymentId: normalizedId,
          bookingId: normalizedBookingId || null,
          reason: 'NO_ROW_FOR_ID'
        });
      }
    }

    if (!canFallbackByBooking) {
      return null;
    }

    let fallbackQuery = supabase
      .from('payments')
      .update(payload)
      .eq('booking_id', normalizedBookingId);

    if (expectedPaymentType) {
      fallbackQuery = fallbackQuery.eq('payment_type', expectedPaymentType);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackQuery.select();

    if (fallbackError) {
      throw fallbackError;
    }

    if (!fallbackData || fallbackData.length === 0) {
      return null;
    }

    if (fallbackData.length > 1) {
      fallbackData.sort((a, b) => {
        const left = new Date(a.updated_at || a.created_at || 0).getTime();
        const right = new Date(b.updated_at || b.created_at || 0).getTime();
        return right - left;
      });
    }

    return fallbackData[0];
  } catch (error) {
    console.error('UPDATE_PAYMENT_ERROR:', error);
    throw error;
  }
}
