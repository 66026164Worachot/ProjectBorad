// services/reservationService.js
import { supabase } from './supabase.js';
import {
  normalizeBookingTable,
  normalizeTableCapacity,
  resolveTableCapacity
} from './tableCapacity.js';

function normalizePrice(value, fallback = 0) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return numeric;
  }
  return fallback;
}

function resolveCategoryPricing(category) {
  if (!category || typeof category !== 'object') {
    return { basePrice: 0, extraHourPrice: 0 };
  }

  const basePrice = normalizePrice(
    category.base_price ?? category.price_per_hour ?? 0,
    0
  );

  const extraHourPrice = normalizePrice(
    category.extra_hour_price ?? category.price_per_hour ?? basePrice,
    basePrice
  );

  return {
    basePrice,
    extraHourPrice
  };
}

function calculateHourlyAmount(hours, basePrice, extraHourPrice) {
  const numericHours = Number(hours);

  if (!Number.isFinite(numericHours) || numericHours <= 0) {
    return 0;
  }

  const normalizedBase = normalizePrice(basePrice, 0);
  if (normalizedBase <= 0) {
    return 0;
  }

  const normalizedExtra = normalizePrice(extraHourPrice, normalizedBase);

  if (numericHours <= 1) {
    return normalizedBase;
  }

  const incrementalRate = normalizedExtra > 0 ? normalizedExtra : normalizedBase;
  return normalizedBase + (numericHours - 1) * incrementalRate;
}

async function fetchFoodOrdersForBookingIds(bookingIds) {
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
    return new Map();
  }

  try {
    const { data, error } = await supabase
      .from('food_orders')
      .select(`
        id,
        booking_id,
        order_number,
        status,
        total_amount,
        special_instructions,
        created_at,
        updated_at,
        items:food_order_items(
          id,
          menu_item_id,
          quantity,
          unit_price,
          subtotal,
          notes,
          menu_item:menu_items(
            id,
            name,
            price
          )
        )
      `)
      .in('booking_id', bookingIds);

    if (error) {
      console.warn('FETCH_FOOD_ORDERS_WARNING:', error);
      return new Map();
    }

    const map = new Map();

    for (const order of data || []) {
      const normalizedOrder = {
        ...order,
        items: (order.items || []).map(item => ({
          ...item,
          menu_item: item.menu_item || null
        }))
      };

      if (map.has(order.booking_id)) {
        map.get(order.booking_id).push(normalizedOrder);
      } else {
        map.set(order.booking_id, [normalizedOrder]);
      }
    }

    return map;
  } catch (error) {
    console.warn('FETCH_FOOD_ORDERS_UNEXPECTED_WARNING:', error);
    return new Map();
  }
}

const PROMOTION_IGNORED_STATUSES = '(cancelled,rejected)';

function createPromotionError(message, code = 'PROMOTION_NOT_AVAILABLE') {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
}

async function fetchActivePromotionById(promotionId) {
  if (!promotionId) {
    throw createPromotionError('Promotion is not available', 'PROMOTION_NOT_FOUND');
  }

  const { data, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('id', promotionId)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw createPromotionError('Promotion is not available', 'PROMOTION_NOT_FOUND');
  }

  return data;
}

async function getPromotionUsageCounts(promotionId, { userId, excludeBookingId } = {}) {
  const baseQuery = () => {
    let query = supabase
      .from('bookings')
      .select('id', { head: true, count: 'exact' })
      .eq('promotion_id', promotionId)
      .not('status', 'in', PROMOTION_IGNORED_STATUSES);

    if (excludeBookingId) {
      query = query.neq('id', excludeBookingId);
    }

    return query;
  };

  const { count: totalCount, error: totalError } = await baseQuery();
  if (totalError) throw totalError;

  if (!userId) {
    return { totalCount: totalCount || 0, userCount: 0 };
  }

  let userQuery = baseQuery().eq('user_id', userId);
  const { count: userCount, error: userError } = await userQuery;
  if (userError) throw userError;

  return {
    totalCount: totalCount || 0,
    userCount: userCount || 0
  };
}

async function ensurePromotionAvailability(promotionId, userId, { excludeBookingId, promotion: existingPromotion } = {}) {
  const promotion = existingPromotion || await fetchActivePromotionById(promotionId);

  if (!promotion) {
    throw createPromotionError('Promotion is not available', 'PROMOTION_NOT_FOUND');
  }

  const now = new Date();

  if (promotion.start_date) {
    const startDate = new Date(promotion.start_date);
    if (Number.isNaN(startDate.getTime())) {
      throw createPromotionError('Promotion schedule is invalid', 'PROMOTION_INVALID_SCHEDULE');
    }
    if (now < startDate) {
      throw createPromotionError('Promotion is not active yet', 'PROMOTION_NOT_STARTED');
    }
  }

  if (promotion.end_date) {
    const endDate = new Date(promotion.end_date);
    if (Number.isNaN(endDate.getTime())) {
      throw createPromotionError('Promotion schedule is invalid', 'PROMOTION_INVALID_SCHEDULE');
    }
    if (now > endDate) {
      throw createPromotionError('Promotion has expired', 'PROMOTION_EXPIRED');
    }
  }

  const usageCounts = await getPromotionUsageCounts(promotion.id, { userId, excludeBookingId });

  if (promotion.max_uses && usageCounts.totalCount >= promotion.max_uses) {
    throw createPromotionError('Promotion usage limit reached', 'PROMOTION_LIMIT_REACHED');
  }

  if (userId && usageCounts.userCount > 0) {
    throw createPromotionError('Promotion already used by this user', 'PROMOTION_PER_USER_LIMIT');
  }

  return { promotion, usageCounts };
}

// ====================================
// 📅 BOOKINGS
// ====================================

/**
 * ดึงรายการจองทั้งหมด (พร้อม filters)
 */
/**
 * ดึงรายการจองทั้งหมด (พร้อม filters)
 */
export async function getAllBookings({
  status,
  date,
  tableId,
  userId,
  search,
  page = 1,
  limit = 20
}) {
  try {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name, phone),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        ),
        promotion:promotions!bookings_promotion_id_fkey(id, name, discount_type, discount_value)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    // Filter by status
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Filter by date
    if (date) {
      query = query.eq('booking_date', date);
    }

    // Filter by table
    if (tableId && tableId !== 'all') {
      query = query.eq('table_id', tableId);
    }

    // Filter by user
    if (userId) {
      query = query.eq('user_id', userId);
    }

    // ⚠️ ถ้ามี search ต้องดึงข้อมูลมากกว่าปกติ
    if (search && search.trim()) {
      query = query.limit(1000); // จำกัดไว้ที่ 1000 records
    } else {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('SUPABASE_ERROR:', error);
      throw error;
    }

    let bookings = (data || []).map(normalizeBookingTable);

    // ✅ SEARCH LOGIC - Filter by customer name, email, or phone
    if (search && search.trim()) {
      const searchLower = search.toLowerCase().trim();
      bookings = bookings.filter(booking => {
        const user = booking.user;
        if (!user) return false;
        
        const fullName = (user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const phone = (user.phone || '').toLowerCase();
        
        return fullName.includes(searchLower) || 
               email.includes(searchLower) || 
               phone.includes(searchLower);
      });

      // Apply pagination to filtered results
      const totalFiltered = bookings.length;
      const from = (page - 1) * limit;
      const to = from + limit;
      bookings = bookings.slice(from, to);

      return {
        bookings,
        pagination: {
          page,
          limit,
          total: totalFiltered,
          totalPages: Math.ceil(totalFiltered / limit)
        }
      };
    }

    return {
      bookings,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error) {
    console.error('GET_ALL_BOOKINGS_ERROR:', error);
    throw error;
  }
}

/**
 * ดึงรายการจองของผู้ใช้คนหนึ่ง (พร้อม pagination)
 */
export async function getBookingsForUser(userId, {
  status,
  page = 1,
  limit = 10,
  upcomingOnly = false
} = {}) {
  if (!userId) {
    throw new Error('USER_ID_REQUIRED');
  }

  try {
    let query = supabase
      .from('bookings')
      .select(`
        *,
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        ),
        promotion:promotions!bookings_promotion_id_fkey(id, name, discount_type, discount_value)
      `, { count: 'exact' })
      .eq('user_id', userId);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (upcomingOnly) {
      const today = new Date().toISOString().split('T')[0];
      query = query
        .gte('booking_date', today)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true });
    } else {
      query = query
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: false });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('GET_BOOKINGS_FOR_USER_ERROR:', error);
      throw error;
    }

    const bookingIds = (data || []).map(row => row.id);
    const foodOrdersMap = await fetchFoodOrdersForBookingIds(bookingIds);

    return {
      bookings: (data || []).map(bookingRow => (
        normalizeBookingTable({
          ...bookingRow,
          food_orders: foodOrdersMap.get(bookingRow.id) || []
        })
      )),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  } catch (error) {
    console.error('GET_BOOKINGS_FOR_USER_ERROR:', error);
    throw error;
  }
}

/**
 * ดึงข้อมูลการจองทีละรายการ
 */
/**
 * ดึงข้อมูลการจองทีละรายการ
 */
export async function getBookingById(id) {
  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name, phone),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        ),
        promotion:promotions!bookings_promotion_id_fkey(id, name, discount_type, discount_value)
      `)
      .eq('id', id)
      .maybeSingle();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      return null;
    }

    return normalizeBookingTable(booking);
  } catch (error) {
    console.error('GET_BOOKING_ERROR:', error);
    throw error;
  }
}

// services/reservationService.js - แทนที่ createBooking function

/**
 * สร้างการจองใหม่ (พร้อมคำนวณมัดจำ)
 */
export async function createBooking(bookingData) {
  try {
    const parseHour = (timeValue) => {
      if (!timeValue) return NaN;
      const [hour] = String(timeValue).split(':');
      const numericHour = Number(hour);
      return Number.isFinite(numericHour) ? numericHour : NaN;
    };

    const startHour = parseHour(bookingData.start_time);
    const endHour = parseHour(bookingData.end_time);
    const hours = endHour - startHour;

    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error('Invalid booking duration');
    }

    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select(`
        id,
        category:room_categories!tables_category_id_fkey(*)
      `)
      .eq('id', bookingData.table_id)
      .maybeSingle();

    if (tableError) throw tableError;
    if (!table || !table.category) {
      throw new Error('Selected table does not have a room category');
    }

    const tableCapacity = resolveTableCapacity(table, 1) ?? 1;

    const normalizedNumberOfPeople = (() => {
      const raw = bookingData.number_of_people;

      if (raw === undefined || raw === null || raw === '') {
        return tableCapacity;
      }

      const numericValue = Number(raw);
      if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return tableCapacity;
      }

      return Math.max(1, Math.trunc(numericValue));
    })();

    const { basePrice, extraHourPrice } = resolveCategoryPricing(table.category);

    if (basePrice <= 0) {
      throw new Error('Invalid pricing for selected room category');
    }

    const baseAmount = calculateHourlyAmount(hours, basePrice, extraHourPrice);

    let finalAmount = baseAmount;
    if (bookingData.promotion_id) {
      if (!bookingData.user_id) {
        throw createPromotionError(
          'Booking must include a customer before applying promotion codes',
          'PROMOTION_USER_REQUIRED'
        );
      }

      const { promotion } = await ensurePromotionAvailability(
        bookingData.promotion_id,
        bookingData.user_id
      );

      const discount = calculateDiscount(baseAmount, promotion);
      finalAmount = Math.max(0, baseAmount - discount);
    }

    const paymentType = bookingData.payment_type && ['advance', 'walk_in'].includes(bookingData.payment_type)
      ? bookingData.payment_type
      : 'advance';

    const depositPercent = 0.10; // 10%
    let deposit = 0;
    let remaining = 0;

    if (paymentType === 'walk_in') {
      deposit = finalAmount;
      remaining = 0;
    } else {
      deposit = finalAmount * depositPercent;
      remaining = finalAmount - deposit;
    }

    const paymentStatus = 'pending';

    const {
      total_amount,
      final_amount,
      deposit_amount,
      remaining_amount,
      number_of_people: _rawNumberOfPeople,
      ...rest
    } = bookingData;

    const bookingToCreate = {
      ...rest,
      total_amount: Number(baseAmount.toFixed(2)),
      final_amount: Number(finalAmount.toFixed(2)),
      payment_type: paymentType,
      deposit_amount: Number(deposit.toFixed(2)),
      remaining_amount: Number(remaining.toFixed(2)),
      payment_status: paymentStatus,
      number_of_people: normalizedNumberOfPeople
    };

    const { data, error } = await supabase
      .from('bookings')
      .insert(bookingToCreate)
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        )
      `)
      .single();

    if (error) throw error;
    return normalizeBookingTable(data);
  } catch (error) {
    console.error('CREATE_BOOKING_ERROR:', error);
    throw error;
  }
}

/**
 * อัพเดทการจอง
 */
export async function updateBooking(id, updates) {
  try {
    const { data: existingBooking, error: existingError } = await supabase
      .from('bookings')
      .select('id, user_id, promotion_id')
      .eq('id', id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existingBooking) {
      throw new Error('Booking not found');
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'promotion_id') && updates.promotion_id === '') {
      updates.promotion_id = null;
    }

    if (Object.prototype.hasOwnProperty.call(updates, 'promotion_id') && updates.promotion_id) {
      if (!existingBooking.user_id) {
        throw createPromotionError('Booking is missing customer information', 'PROMOTION_USER_REQUIRED');
      }

      await ensurePromotionAvailability(updates.promotion_id, existingBooking.user_id, {
        excludeBookingId: existingBooking.id
      });
    }

    const { data, error } = await supabase
      .from('bookings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        )
      `)
      .single();

    if (error) throw error;
    return normalizeBookingTable(data);
  } catch (error) {
    console.error('UPDATE_BOOKING_ERROR:', error);
    throw error;
  }
}

/**
 * ยกเลิกการจอง
 */
export async function cancelBooking(id) {
  try {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        payment_status: 'cancelled',
        updated_at: now
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        payment_status: 'rejected',
        rejection_reason: 'Booking cancelled',
        updated_at: now
      })
      .eq('booking_id', id)
      .eq('payment_status', 'pending');

    if (paymentUpdateError) {
      console.error('CANCEL_BOOKING_PAYMENT_UPDATE_ERROR:', paymentUpdateError);
    }

    return data;
  } catch (error) {
    console.error('CANCEL_BOOKING_ERROR:', error);
    throw error;
  }
}

/**
 * อนุมัติการจอง
 */
export async function approveBooking(id, approvedBy) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'approved',
        approved_by: approvedBy,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('APPROVE_BOOKING_ERROR:', error);
    throw error;
  }
}

/**
 * ปฏิเสธการจอง
 */
export async function rejectBooking(id, reason) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'rejected',
        rejected_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('REJECT_BOOKING_ERROR:', error);
    throw error;
  }
}

/**
 * Check-in
 */
export async function checkInBooking(id, checkedInBy) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'checked_in',
        checked_in_by: checkedInBy,
        checked_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('CHECK_IN_ERROR:', error);
    throw error;
  }
}

/**
 * Check-out
 */
export async function checkOutBooking(id) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'checked_out',
        checked_out_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('CHECK_OUT_ERROR:', error);
    throw error;
  }
}

/**
 * ตรวจสอบโต๊ะว่าง
 */
export async function getAvailableTables(date, startTime, endTime, excludeBookingId = null) {
  try {
    // ดึงโต๊ะทั้งหมดที่ status = available พร้อมข้อมูลหมวดห้อง
    const { data: allTables, error: tablesError } = await supabase
      .from('tables')
      .select(`
        *,
        category:room_categories!tables_category_id_fkey(*)
      `)
      .eq('status', 'available')
      .order('table_number');

    if (tablesError) throw tablesError;

    // ดึงการจองที่ทับซ้อนเวลา
    let bookingsQuery = supabase
      .from('bookings')
      .select('table_id')
      .eq('booking_date', date)
      .in('status', ['waiting', 'approved', 'checked_in'])
      .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`);

    if (excludeBookingId) {
      bookingsQuery = bookingsQuery.neq('id', excludeBookingId);
    }

    const { data: conflictBookings, error: bookingsError } = await bookingsQuery;

    if (bookingsError) throw bookingsError;

    // Filter ออกโต๊ะที่มีการจองแล้ว
    const bookedTableIds = conflictBookings.map(b => b.table_id);
    const normalizedTables = (allTables || []).map(normalizeTableCapacity);
    const availableTables = normalizedTables.filter(t => !bookedTableIds.includes(t.id));

    return availableTables;
  } catch (error) {
    console.error('GET_AVAILABLE_TABLES_ERROR:', error);
    throw error;
  }
}

/**
 * สถิติการจอง
 */
export async function getBookingStats() {
  try {
    // Total bookings
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('status, booking_date, created_at');

    if (error) throw error;

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    const stats = {
      total: allBookings.length,
      byStatus: {
        waiting: allBookings.filter(b => b.status === 'waiting').length,
        approved: allBookings.filter(b => b.status === 'approved').length,
        checked_in: allBookings.filter(b => b.status === 'checked_in').length,
        checked_out: allBookings.filter(b => b.status === 'checked_out').length,
        cancelled: allBookings.filter(b => b.status === 'cancelled').length,
        rejected: allBookings.filter(b => b.status === 'rejected').length,
        completed: allBookings.filter(b => b.status === 'completed').length
      },
      today: allBookings.filter(b => b.booking_date === today).length,
      thisMonth: allBookings.filter(b => b.booking_date.startsWith(thisMonth)).length
    };

    return stats;
  } catch (error) {
    console.error('GET_BOOKING_STATS_ERROR:', error);
    throw error;
  }
}

// ====================================
// 🪑 TABLES
// ====================================

/**
 * ดึงโต๊ะทั้งหมด
 */
export async function getAllTables() {
  try {
    const { data, error } = await supabase
      .from('tables')
      .select(`
        *,
        category:room_categories!tables_category_id_fkey(*)
      `)
      .order('table_number');

    if (error) throw error;
    return (data || []).map(normalizeTableCapacity);
  } catch (error) {
    console.error('GET_ALL_TABLES_ERROR:', error);
    throw error;
  }
}

/**
 * ดึงราคาต่อชั่วโมง
 */
export async function getRoomCategories({ includeInactive = true } = {}) {
  try {
    let query = supabase
      .from('room_categories')
      .select('*');

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query
      .order('price_per_hour', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('GET_ROOM_CATEGORIES_ERROR:', error);
    throw error;
  }
}

export async function getPricing() {
  try {
    return await getRoomCategories({ includeInactive: false });
  } catch (error) {
    console.error('GET_PRICING_ERROR:', error);
    throw error;
  }
}

function buildCategoryError(messages) {
  const error = new Error(Array.isArray(messages) ? messages.join(', ') : messages || 'Invalid category data');
  error.statusCode = 400;
  error.details = Array.isArray(messages) ? messages : [messages];
  return error;
}

function sanitizeCategoryPayload(payload, existing = null) {
  const merged = existing ? { ...existing, ...payload } : { ...payload };
  const errors = [];
  const sanitized = {};

  const rawCode = merged.code;
  const code = rawCode === undefined || rawCode === null
    ? ''
    : String(rawCode).trim().toUpperCase();
  if (!code) {
    errors.push('Category code is required');
  } else {
    sanitized.code = code;
  }

  const rawName = merged.name;
  const name = rawName === undefined || rawName === null
    ? ''
    : String(rawName).trim();
  if (!name) {
    errors.push('Category name is required');
  } else {
    sanitized.name = name;
  }

  if ('description' in merged) {
    const description = merged.description === null || merged.description === undefined
      ? null
      : String(merged.description).trim();
    sanitized.description = description || null;
  } else if (existing) {
    sanitized.description = existing.description ?? null;
  } else {
    sanitized.description = null;
  }

  const baseCandidate = merged.base_price ?? merged.basePrice ?? merged.price_per_hour;
  const basePrice = Number(baseCandidate);
  if (!Number.isFinite(basePrice) || basePrice <= 0) {
    errors.push('Base price must be greater than zero');
  } else {
    sanitized.base_price = Number(basePrice.toFixed(2));
    sanitized.price_per_hour = sanitized.base_price;
  }

  const extraCandidate = merged.extra_hour_price ?? merged.extraHourPrice ?? merged.extra_price ?? merged.extraPrice;
  if (extraCandidate === undefined || extraCandidate === null || extraCandidate === '') {
    sanitized.extra_hour_price = sanitized.base_price;
  } else {
    const extraPrice = Number(extraCandidate);
    if (!Number.isFinite(extraPrice) || extraPrice < 0) {
      errors.push('Additional hour price must be zero or greater');
    } else {
      sanitized.extra_hour_price = extraPrice > 0 ? Number(extraPrice.toFixed(2)) : sanitized.base_price;
    }
  }

  const isActive = merged.is_active ?? merged.isActive;
  if (isActive === undefined) {
    sanitized.is_active = existing ? Boolean(existing.is_active) : true;
  } else {
    sanitized.is_active = Boolean(isActive);
  }

  if (errors.length > 0) {
    throw buildCategoryError(errors);
  }

  sanitized.updated_at = new Date().toISOString();

  return sanitized;
}

export async function createRoomCategory(categoryData) {
  try {
    const sanitized = sanitizeCategoryPayload(categoryData);

    const { data: duplicates, error: duplicateError } = await supabase
      .from('room_categories')
      .select('id')
      .eq('code', sanitized.code)
      .limit(1);

    if (duplicateError) throw duplicateError;
    if (duplicates && duplicates.length > 0) {
      throw buildCategoryError('Category code already exists');
    }

    const { data, error } = await supabase
      .from('room_categories')
      .insert(sanitized)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('CREATE_ROOM_CATEGORY_ERROR:', error);
    throw error;
  }
}

export async function updateRoomCategory(categoryId, categoryData) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('room_categories')
      .select('*')
      .eq('id', categoryId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }

    const sanitized = sanitizeCategoryPayload(categoryData, existing);

    const { data: duplicates, error: duplicateError } = await supabase
      .from('room_categories')
      .select('id')
      .eq('code', sanitized.code)
      .neq('id', categoryId)
      .limit(1);

    if (duplicateError) throw duplicateError;
    if (duplicates && duplicates.length > 0) {
      throw buildCategoryError('Category code already exists');
    }

    const { data, error } = await supabase
      .from('room_categories')
      .update(sanitized)
      .eq('id', categoryId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('UPDATE_ROOM_CATEGORY_ERROR:', error);
    throw error;
  }
}

export async function deleteRoomCategory(categoryId) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('room_categories')
      .select('id')
      .eq('id', categoryId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (!existing) {
      const error = new Error('Category not found');
      error.statusCode = 404;
      throw error;
    }

    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id')
      .eq('category_id', categoryId)
      .limit(1);

    if (tablesError) throw tablesError;

    if (tables && tables.length > 0) {
      throw buildCategoryError('Cannot delete category while tables are assigned to it');
    }

    const { error } = await supabase
      .from('room_categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('DELETE_ROOM_CATEGORY_ERROR:', error);
    throw error;
  }
}

function buildTableError(message) {
  const error = new Error(message || 'Invalid table data');
  error.statusCode = 400;
  return error;
}

function sanitizeTablePayload(payload, existing = null) {
  const merged = existing ? { ...existing, ...payload } : { ...payload };
  const errors = [];
  const sanitized = {};

  const tableNumberRaw = merged.table_number ?? merged.tableNumber;
  const tableNumber = typeof tableNumberRaw === 'string' ? tableNumberRaw.trim().toUpperCase() : '';
  if (!tableNumber) {
    errors.push('Table number is required');
  } else {
    sanitized.table_number = tableNumber;
  }

  const statusRaw = merged.status;
  sanitized.status = typeof statusRaw === 'string' && statusRaw.trim()
    ? statusRaw.trim().toLowerCase()
    : 'available';

  const descriptionRaw = merged.description;
  sanitized.description = descriptionRaw === undefined || descriptionRaw === null
    ? null
    : String(descriptionRaw).trim() || null;

  if (Object.prototype.hasOwnProperty.call(merged, 'capacity')) {
    if (merged.capacity === null || merged.capacity === undefined || merged.capacity === '') {
      sanitized.capacity = null;
    } else {
      const numericCapacity = Number(merged.capacity);
      if (!Number.isFinite(numericCapacity) || numericCapacity <= 0) {
        errors.push('Capacity must be a positive number');
      } else {
        sanitized.capacity = Math.trunc(numericCapacity);
      }
    }
  }

  const categoryId = merged.category_id ?? merged.categoryId ?? null;
  sanitized.category_id = categoryId || null;

  if (errors.length > 0) {
    throw buildTableError(errors.join(', '));
  }

  sanitized.updated_at = new Date().toISOString();

  return sanitized;
}

async function ensureCategoryExists(categoryId) {
  if (!categoryId) {
    return null;
  }

  const { data, error } = await supabase
    .from('room_categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw buildTableError('Selected table category was not found');
  }

  return data;
}

function isMissingCapacityColumnError(error) {
  return (
    error?.code === 'PGRST204' &&
    typeof error?.message === 'string' &&
    error.message.includes("'capacity' column")
  );
}

export async function createTable(tableData) {
  try {
    const sanitized = sanitizeTablePayload(tableData);

    await ensureCategoryExists(sanitized.category_id);

    const { data: duplicates, error: duplicateError } = await supabase
      .from('tables')
      .select('id')
      .eq('table_number', sanitized.table_number)
      .limit(1);

    if (duplicateError) throw duplicateError;
    if (duplicates && duplicates.length > 0) {
      throw buildTableError('Table number already exists');
    }

    let mutation = supabase
      .from('tables')
      .insert(sanitized)
      .select(`
        *,
        category:room_categories!tables_category_id_fkey(*)
      `)
      .single();

    let { data, error } = await mutation;

    if (error && isMissingCapacityColumnError(error) && Object.prototype.hasOwnProperty.call(sanitized, 'capacity')) {
      console.warn('TABLE_CAPACITY_COLUMN_MISSING: retrying table insert without capacity field');
      const sanitizedWithoutCapacity = { ...sanitized };
      delete sanitizedWithoutCapacity.capacity;

      mutation = supabase
        .from('tables')
        .insert(sanitizedWithoutCapacity)
        .select(`
          *,
          category:room_categories!tables_category_id_fkey(*)
        `)
        .single();

      ({ data, error } = await mutation);
    }

    if (error) throw error;

    return normalizeTableCapacity(data);
  } catch (error) {
    console.error('CREATE_TABLE_ERROR:', error);
    throw error;
  }
}

export async function updateTable(tableId, tableData) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', tableId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      const error = new Error('Table not found');
      error.statusCode = 404;
      throw error;
    }

    const sanitized = sanitizeTablePayload(tableData, existing);

    await ensureCategoryExists(sanitized.category_id);

    const { data: duplicates, error: duplicateError } = await supabase
      .from('tables')
      .select('id')
      .eq('table_number', sanitized.table_number)
      .neq('id', tableId)
      .limit(1);

    if (duplicateError) throw duplicateError;
    if (duplicates && duplicates.length > 0) {
      throw buildTableError('Table number already exists');
    }

    let mutation = supabase
      .from('tables')
      .update(sanitized)
      .eq('id', tableId)
      .select(`
        *,
        category:room_categories!tables_category_id_fkey(*)
      `)
      .single();

    let { data, error } = await mutation;

    if (error && isMissingCapacityColumnError(error) && Object.prototype.hasOwnProperty.call(sanitized, 'capacity')) {
      console.warn('TABLE_CAPACITY_COLUMN_MISSING: retrying table update without capacity field');
      const sanitizedWithoutCapacity = { ...sanitized };
      delete sanitizedWithoutCapacity.capacity;

      mutation = supabase
        .from('tables')
        .update(sanitizedWithoutCapacity)
        .eq('id', tableId)
        .select(`
          *,
          category:room_categories!tables_category_id_fkey(*)
        `)
        .single();

      ({ data, error } = await mutation);
    }

    if (error) throw error;

    return normalizeTableCapacity(data);
  } catch (error) {
    console.error('UPDATE_TABLE_ERROR:', error);
    throw error;
  }
}

export async function deleteTable(tableId) {
  try {
    const { data: existing, error: existingError } = await supabase
      .from('tables')
      .select('id')
      .eq('id', tableId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (!existing) {
      const error = new Error('Table not found');
      error.statusCode = 404;
      throw error;
    }

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .eq('table_id', tableId)
      .limit(1);

    if (bookingsError) throw bookingsError;

    if (bookings && bookings.length > 0) {
      throw buildTableError('Cannot delete table while bookings exist for it');
    }

    const { error } = await supabase
      .from('tables')
      .delete()
      .eq('id', tableId);

    if (error) throw error;

    return { ok: true };
  } catch (error) {
    console.error('DELETE_TABLE_ERROR:', error);
    throw error;
  }
}

/**
 * สร้างโปรโมชันใหม่
 */
export async function createPromotion(promotionData) {
  try {
    const {
      name,
      discount_type,
      discount_value,
      description,
      start_date,
      end_date,
      max_uses,
      min_amount
    } = promotionData;

    if (!name || !name.trim()) {
      throw new Error('Promotion code is required');
    }

    const code = name.trim().toUpperCase();
    const allowedTypes = ['percentage', 'fixed_amount'];

    if (!allowedTypes.includes(discount_type)) {
      throw new Error('Invalid discount type');
    }

    const numericDiscount = Number(discount_value);

    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0) {
      throw new Error('Discount value must be greater than zero');
    }

    if (discount_type === 'percentage' && numericDiscount > 100) {
      throw new Error('Percentage discount cannot exceed 100');
    }

    let minimumAmount;
    if (min_amount !== undefined && min_amount !== null && min_amount !== '') {
      minimumAmount = Number(min_amount);
      if (!Number.isFinite(minimumAmount) || minimumAmount < 0) {
        throw new Error('Minimum amount must be zero or greater');
      }
    }

    if (max_uses === undefined || max_uses === null || max_uses === '') {
      throw new Error('Usage limit is required');
    }

    const maxUsesValue = Number(max_uses);
    if (!Number.isInteger(maxUsesValue) || maxUsesValue <= 0) {
      throw new Error('Usage limit must be a positive integer');
    }

    const now = new Date();
    let start = start_date ? new Date(start_date) : now;
    if (Number.isNaN(start.getTime())) {
      throw new Error('Invalid start date');
    }

    let end = end_date ? new Date(end_date) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (Number.isNaN(end.getTime())) {
      throw new Error('Invalid end date');
    }

    if (end < start) {
      throw new Error('End date must be after start date');
    }

    const { data: existing, error: existingError } = await supabase
      .from('promotions')
      .select('id')
      .eq('name', code)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      throw new Error('Promotion code already exists');
    }

    const insertData = {
      name: code,
      description: description?.trim() || null,
      discount_type,
      discount_value: numericDiscount,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      status: 'active',
      current_uses: 0,
      max_uses: maxUsesValue,
      ...(minimumAmount !== undefined ? { min_amount: minimumAmount } : {})
    };

    const { data, error } = await supabase
      .from('promotions')
      .insert(insertData)
      .select('*')
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error('CREATE_PROMOTION_ERROR:', error);
    throw error;
  }
}

/**
 * ตรวจสอบโค้ดส่วนลด
 */
export async function validatePromotion(code, userId, { bookingId } = {}) {
  try {
    const normalizedCode = code?.trim().toUpperCase();
    if (!normalizedCode) {
      return { valid: false, message: 'Invalid promotion code' };
    }

    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .ilike('name', normalizedCode)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return { valid: false, message: 'Invalid promotion code' };
    }

    try {
      const { promotion, usageCounts } = await ensurePromotionAvailability(
        data.id,
        userId,
        { excludeBookingId: bookingId, promotion: data }
      );

      const remainingUses = promotion.max_uses
        ? Math.max(promotion.max_uses - (usageCounts.totalCount || 0), 0)
        : null;

      const responsePromotion = {
        ...promotion,
        remaining_uses: remainingUses
      };

      const message = remainingUses !== null
        ? `Promotion code is valid (${remainingUses} use${remainingUses === 1 ? '' : 's'} remaining)`
        : 'Promotion code is valid';

      return {
        valid: true,
        promotion: responsePromotion,
        message
      };
    } catch (availabilityError) {
      if (availabilityError.statusCode === 400) {
        return { valid: false, message: availabilityError.message };
      }
      throw availabilityError;
    }
  } catch (error) {
    console.error('VALIDATE_PROMOTION_ERROR:', error);
    throw error;
  }
}
/**
 * คำนวณราคา
 */
export function calculatePrice(hours, pricingOrBase, extraHourPrice) {
  if (
    pricingOrBase &&
    typeof pricingOrBase === 'object' &&
    extraHourPrice === undefined
  ) {
    const { basePrice, extraHourPrice: resolvedExtra } = resolveCategoryPricing(pricingOrBase);
    return calculateHourlyAmount(hours, basePrice, resolvedExtra);
  }

  return calculateHourlyAmount(hours, pricingOrBase, extraHourPrice);
}

/**
 * คำนวณส่วนลด
 */
export function calculateDiscount(amount, promotion) {
  if (!promotion) return 0;

  if (promotion.discount_type === 'percentage') {
    return amount * (promotion.discount_value / 100);
  } else if (promotion.discount_type === 'fixed_amount') {
    return Math.min(promotion.discount_value, amount);
  }

  return 0;
}


// services/reservationService.js (เพิ่มท้ายไฟล์)

/**
 * จ่ายมัดจำ (10%)
 */
export async function payDeposit(bookingId) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        payment_status: 'deposit_paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        )
      `)
      .single();

    if (error) throw error;
    return normalizeBookingTable(data);
  } catch (error) {
    console.error('PAY_DEPOSIT_ERROR:', error);
    throw error;
  }
}

/**
 * จ่ายส่วนที่เหลือ (90%)
 */
export async function payRemaining(bookingId) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        remaining_paid: true,
        remaining_paid_at: new Date().toISOString(),
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        )
      `)
      .single();

    if (error) throw error;
    return normalizeBookingTable(data);
  } catch (error) {
    console.error('PAY_REMAINING_ERROR:', error);
    throw error;
  }
}

/**
 * จ่ายเต็มจำนวน (Walk-in - 100%)
 */
export async function payFull(bookingId) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        deposit_paid: true,
        deposit_paid_at: new Date().toISOString(),
        remaining_paid: true,
        remaining_paid_at: new Date().toISOString(),
        payment_status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select(`
        *,
        user:users!bookings_user_id_fkey(id, email, full_name),
        table:tables!bookings_table_id_fkey(
          id,
          table_number,
          description,
          category:room_categories!tables_category_id_fkey(*)
        )
      `)
      .single();

    if (error) throw error;
    return normalizeBookingTable(data);
  } catch (error) {
    console.error('PAY_FULL_ERROR:', error);
    throw error;
  }
}