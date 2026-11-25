// services/dashboardService.js
import { supabase } from './supabase.js';

/**
 * ดึงสถิติ Dashboard แบบ real-time
 * @param {string} period - 'today' | 'week' | 'month'
 * @param {string} userRole - 'staff' | 'manager'
 */
export async function getDashboardStats(period = 'today', userRole = 'staff') {
  try {
    const dateRange = getDateRange(period);
    const isManager = userRole === 'manager';

    // Parallel queries for better performance
    const [
      bookingsData,
      usersData,
      paymentsData,
      menuData,
      revenueData
    ] = await Promise.all([
      getBookingStats(dateRange, isManager),
      isManager ? getUserStats(dateRange) : null,
      getPaymentStats(dateRange, isManager),
      isManager ? getMenuStats() : null,
      getRevenueStats(dateRange, isManager)
    ]);

    return {
      period,
      dateRange,
      bookings: bookingsData,
      users: usersData,
      payments: paymentsData,
      menu: menuData,
      revenue: revenueData,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    console.error('GET_DASHBOARD_STATS_ERROR:', error);
    throw error;
  }
}

/**
 * คำนวณช่วงเวลา
 */
function getDateRange(period) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  switch (period) {
    case 'today':
      return { start: today, end: today };
    
    case 'week': {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return { 
        start: weekAgo.toISOString().split('T')[0], 
        end: today 
      };
    }
    
    case 'month': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(now.getMonth() - 1);
      return { 
        start: monthAgo.toISOString().split('T')[0], 
        end: today 
      };
    }
    
    default:
      return { start: today, end: today };
  }
}

/**
 * สถิติการจอง
 */
async function getBookingStats(dateRange, isManager) {
  try {
    let query = supabase
      .from('bookings')
      .select('status, booking_date, total_amount, created_at')
      .gte('booking_date', dateRange.start)
      .lte('booking_date', dateRange.end);

    const { data: bookings, error } = await query;
    if (error) throw error;

    const stats = {
      total: bookings.length,
      byStatus: {
        waiting: bookings.filter(b => b.status === 'waiting').length,
        approved: bookings.filter(b => b.status === 'approved').length,
        checked_in: bookings.filter(b => b.status === 'checked_in').length,
        checked_out: bookings.filter(b => b.status === 'checked_out').length,
        completed: bookings.filter(b => b.status === 'completed').length,
        cancelled: bookings.filter(b => b.status === 'cancelled').length,
        rejected: bookings.filter(b => b.status === 'rejected').length
      }
    };

    // Manager เห็นรายละเอียดเพิ่มเติม
    if (isManager) {
      stats.totalRevenue = bookings.reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
      stats.averageBookingValue = stats.total > 0 ? stats.totalRevenue / stats.total : 0;
      
      // Booking trends (daily)
      stats.trends = calculateDailyTrends(bookings, dateRange);
    }

    return stats;
  } catch (error) {
    console.error('GET_BOOKING_STATS_ERROR:', error);
    throw error;
  }
}

/**
 * สถิติผู้ใช้ (Manager only)
 */
async function getUserStats(dateRange) {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('role, created_at')
      .gte('created_at', dateRange.start + 'T00:00:00Z')
      .lte('created_at', dateRange.end + 'T23:59:59Z');

    if (error) throw error;

    return {
      newUsers: users.length,
      byRole: {
        user: users.filter(u => u.role === 'user').length,
        staff: users.filter(u => u.role === 'staff').length,
        manager: users.filter(u => u.role === 'manager').length
      }
    };
  } catch (error) {
    console.error('GET_USER_STATS_ERROR:', error);
    throw error;
  }
}

/**
 * สถิติการชำระเงิน
 */
async function getPaymentStats(dateRange, isManager) {
  try {
    let query = supabase
      .from('payments')
      .select('payment_status, payment_type, amount, created_at')
      .gte('created_at', dateRange.start + 'T00:00:00Z')
      .lte('created_at', dateRange.end + 'T23:59:59Z');

    const { data: payments, error } = await query;
    if (error) throw error;

    const stats = {
      total: payments.length,
      byStatus: {
        pending: payments.filter(p => p.payment_status === 'pending').length,
        verified: payments.filter(p => p.payment_status === 'verified').length,
        rejected: payments.filter(p => p.payment_status === 'rejected').length
      }
    };

    // Manager เห็นยอดเงิน
    if (isManager) {
      stats.totalAmount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      stats.verifiedAmount = payments
        .filter(p => p.payment_status === 'verified')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      stats.pendingAmount = payments
        .filter(p => p.payment_status === 'pending')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    }

    return stats;
  } catch (error) {
    console.error('GET_PAYMENT_STATS_ERROR:', error);
    throw error;
  }
}

/**
 * สถิติเมนู (Manager only)
 */
async function getMenuStats() {
  try {
    const { data: items, error } = await supabase
      .from('menu_items')
      .select('is_available');

    if (error) throw error;

    return {
      total: items.length,
      available: items.filter(i => i.is_available).length,
      unavailable: items.filter(i => !i.is_available).length
    };
  } catch (error) {
    console.error('GET_MENU_STATS_ERROR:', error);
    throw error;
  }
}

/**
 * สถิติรายได้ (Manager เห็นแบบละเอียด, Staff เห็นแบบคร่าวๆ)
 */
async function getRevenueStats(dateRange, isManager) {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, total_amount, deposit_amount, final_amount, payment_status, deposit_paid, booking_date')
      .gte('booking_date', dateRange.start)
      .lte('booking_date', dateRange.end);

    if (error) throw error;

    const bookingRows = Array.isArray(bookings) ? bookings : [];

    if (!isManager) {
      // Staff เห็นแค่จำนวนการจองและจำนวนที่ยังไม่จ่ายครบ
      return {
        bookingsCount: bookingRows.length,
        pendingPayments: bookingRows.filter(b => calculateOutstandingAmount(b) > 0).length
      };
    }

    const startDateTime = `${dateRange.start}T00:00:00Z`;
    const endDateTime = `${dateRange.end}T23:59:59Z`;
    const startTimeMs = new Date(startDateTime).getTime();
    const endTimeMs = new Date(endDateTime).getTime();

    const isWithinPeriod = (iso) => {
      if (!iso) return false;
      const time = new Date(iso).getTime();
      return time >= startTimeMs && time <= endTimeMs;
    };

    const { data: foodOrders, error: foodError } = await supabase
      .from('food_orders')
      .select('id, order_number, total_amount, status, created_at')
      .gte('created_at', startDateTime)
      .lte('created_at', endDateTime);

    if (foodError) throw foodError;

    const foodOrderRows = Array.isArray(foodOrders) ? foodOrders : [];

    const { data: foodPayments, error: foodPaymentError } = await supabase
      .from('payments')
      .select('amount, payment_status, transaction_ref, verified_at, created_at')
      .ilike('transaction_ref', 'FOOD-%')
      .or(
        `and(created_at.gte.${startDateTime},created_at.lte.${endDateTime}),and(verified_at.gte.${startDateTime},verified_at.lte.${endDateTime})`
      );

    if (foodPaymentError) throw foodPaymentError;

    const foodPaymentRows = (Array.isArray(foodPayments) ? foodPayments : []).filter(payment =>
      isWithinPeriod(payment?.verified_at) || isWithinPeriod(payment?.created_at)
    );

    const roomRevenue = bookingRows.reduce((sum, booking) => {
      if ((booking.payment_status || '').toLowerCase() === 'paid') {
        return sum + resolveBookingAmount(booking);
      }
      return sum;
    }, 0);

    const pendingRoomRevenue = bookingRows.reduce(
      (sum, booking) => sum + calculateOutstandingAmount(booking),
      0
    );

    const depositCollected = bookingRows.reduce((sum, booking) => {
      if (booking.deposit_paid) {
        return sum + parseMoney(booking.deposit_amount);
      }
      return sum;
    }, 0);

    const verifiedFoodPayments = foodPaymentRows.filter(
      payment => (payment.payment_status || '').toLowerCase() === 'verified'
    );

    const paidFoodOrderNumbers = new Set(
      verifiedFoodPayments
        .map(payment => (payment.transaction_ref || '').replace('FOOD-', '').trim())
        .filter(Boolean)
    );

    const paidFoodOrders = foodOrderRows.filter(order => {
      const status = (order.status || '').toLowerCase();
      return status === 'paid' || paidFoodOrderNumbers.has(order.order_number);
    });

    const pendingFoodOrders = foodOrderRows.filter(order => {
      const status = (order.status || '').toLowerCase();
      if (status === 'cancelled') return false;
      if (status === 'paid') return false;
      if (paidFoodOrderNumbers.has(order.order_number)) return false;
      return true;
    });

    const verifiedFoodRevenue = verifiedFoodPayments.reduce(
      (sum, payment) => sum + parseMoney(payment.amount),
      0
    );

    const manuallyMarkedFoodRevenue = foodOrderRows
      .filter(order => (order.status || '').toLowerCase() === 'paid' && !paidFoodOrderNumbers.has(order.order_number))
      .reduce((sum, order) => sum + parseMoney(order.total_amount), 0);

    const foodRevenue = verifiedFoodRevenue + manuallyMarkedFoodRevenue;
    const pendingFoodRevenue = pendingFoodOrders.reduce(
      (sum, order) => sum + parseMoney(order.total_amount),
      0
    );

    const totalRevenue = roomRevenue + foodRevenue;

    return {
      totalRevenue,
      verifiedRevenue: totalRevenue,
      paidRevenue: roomRevenue, // คง field เดิมเพื่อให้ frontend เดิมใช้งานได้
      roomRevenue,
      foodRevenue,
      pendingRevenue: pendingRoomRevenue + pendingFoodRevenue,
      pendingRoomRevenue,
      pendingFoodRevenue,
      depositCollected,
      bookingsCount: bookingRows.length,
      verifiedBookings: bookingRows.filter(b => (b.payment_status || '').toLowerCase() === 'paid').length,
      averageOrderValue: bookingRows.length > 0 ? totalRevenue / bookingRows.length : 0,
      foodOrdersCount: foodOrderRows.length,
      paidFoodOrders: paidFoodOrders.length,
      pendingFoodOrders: pendingFoodOrders.length
    };
  } catch (error) {
    console.error('GET_REVENUE_STATS_ERROR:', error);
    throw error;
  }
}

function parseMoney(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function resolveBookingAmount(booking) {
  const finalAmount = parseMoney(booking?.final_amount);
  if (finalAmount > 0) {
    return finalAmount;
  }
  return parseMoney(booking?.total_amount);
}

function calculateOutstandingAmount(booking) {
  const status = (booking?.payment_status || '').toLowerCase();
  const amount = resolveBookingAmount(booking);

  if (['paid', 'cancelled', 'rejected', 'refunded'].includes(status)) {
    return 0;
  }

  if (status === 'deposit_paid' || booking?.deposit_paid) {
    const outstanding = amount - parseMoney(booking?.deposit_amount);
    return outstanding > 0 ? outstanding : 0;
  }

  return amount;
}

/**
 * คำนวณ trends รายวัน
 */
function calculateDailyTrends(bookings, dateRange) {
  const trends = {};
  const start = new Date(dateRange.start);
  const end = new Date(dateRange.end);

  // Initialize all dates in range
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    trends[dateStr] = {
      bookings: 0,
      revenue: 0
    };
  }

  // Fill with actual data
  bookings.forEach(booking => {
    const date = booking.booking_date;
    if (trends[date]) {
      trends[date].bookings += 1;
      trends[date].revenue += resolveBookingAmount(booking);
    }
  });

  return Object.entries(trends).map(([date, data]) => ({
    date,
    bookings: data.bookings,
    revenue: data.revenue
  }));
}

