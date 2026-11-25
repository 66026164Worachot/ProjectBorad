// routes/apiReservationRoutes.js
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  getAllBookings,
  getBookingsForUser,
  getBookingById,
  createBooking,
  updateBooking,
  cancelBooking,
  approveBooking,
  rejectBooking,
  checkInBooking,
  checkOutBooking,
  getAvailableTables,
  getBookingStats,
  getAllTables,
  getPricing,
  getRoomCategories,
  validatePromotion,
  payDeposit,
  payRemaining,
  payFull,
  createPromotion,
  createRoomCategory,
  updateRoomCategory,
  deleteRoomCategory,
  createTable,
  updateTable,
  deleteTable
} from '../services/reservationService.js';
import { createPayment } from '../services/paymentService.js';

const r = Router();

const requireStaffOrManager = (req, res, next) => {
  if (!['staff', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Staff or Manager access required' }
    });
  }
  next();
};

const requireManager = (req, res, next) => {
  if (req.user.role !== 'manager') {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Manager access required' }
    });
  }
  next();
};

// ====================================
// ⭐ CRITICAL: PUBLIC ROUTES MUST BE FIRST!
// ====================================

/**
 * GET /api/reservations/pricing - ดึงราคา (NO AUTH REQUIRED)
 */
r.get('/pricing', async (req, res) => {
  try {
    console.log('✅ GET /pricing called');
    const pricing = await getPricing();
    console.log('✅ Pricing data:', pricing);
    return res.json({ ok: true, data: pricing });
  } catch (error) {
    console.error('❌ GET_PRICING_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch pricing' }
    });
  }
});

/**
 * GET /api/reservations/stats
 */
r.get('/stats', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const stats = await getBookingStats();
    return res.json({ ok: true, data: stats });
  } catch (error) {
    console.error('GET_STATS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'STATS_FAILED', message: 'Failed to fetch stats' }
    });
  }
});

/**
 * GET /api/reservations/tables
 */
r.get('/tables', authenticateToken, async (req, res) => {
  try {
    const tables = await getAllTables();
    return res.json({ ok: true, data: tables });
  } catch (error) {
    console.error('GET_TABLES_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch tables' }
    });
  }
});

/**
 * POST /api/reservations/tables
 */
r.post('/tables', authenticateToken, requireManager, async (req, res) => {
  try {
    const table = await createTable(req.body || {});
    return res.status(201).json({ ok: true, data: table });
  } catch (error) {
    console.error('CREATE_TABLE_ROUTE_ERROR:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code: 'CREATE_TABLE_FAILED',
        message: error.message || 'Failed to create table'
      }
    });
  }
});

/**
 * PUT /api/reservations/tables/:id
 */
r.put('/tables/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const table = await updateTable(req.params.id, req.body || {});
    return res.json({ ok: true, data: table });
  } catch (error) {
    console.error('UPDATE_TABLE_ROUTE_ERROR:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code: 'UPDATE_TABLE_FAILED',
        message: error.message || 'Failed to update table'
      }
    });
  }
});

/**
 * DELETE /api/reservations/tables/:id
 */
r.delete('/tables/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    await deleteTable(req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('DELETE_TABLE_ROUTE_ERROR:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code: 'DELETE_TABLE_FAILED',
        message: error.message || 'Failed to delete table'
      }
    });
  }
});

/**
 * POST /api/reservations/available-tables
 */
r.post('/available-tables', authenticateToken, async (req, res) => {
  try {
    const { date, start_time, end_time, exclude_booking_id } = req.body;

    if (!date || !start_time || !end_time) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Date, start_time, and end_time are required' }
      });
    }

    const tables = await getAvailableTables(date, start_time, end_time, exclude_booking_id);
    return res.json({ ok: true, data: tables });
  } catch (error) {
    console.error('GET_AVAILABLE_TABLES_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to check available tables' }
    });
  }
});

/**
 * GET /api/reservations/categories
 */
r.get('/categories', authenticateToken, requireManager, async (req, res) => {
  try {
    const categories = await getRoomCategories({ includeInactive: true });
    return res.json({ ok: true, data: categories });
  } catch (error) {
    console.error('GET_CATEGORIES_ROUTE_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch table categories' }
    });
  }
});

/**
 * POST /api/reservations/categories
 */
r.post('/categories', authenticateToken, requireManager, async (req, res) => {
  try {
    const category = await createRoomCategory(req.body || {});
    return res.status(201).json({ ok: true, data: category });
  } catch (error) {
    console.error('CREATE_CATEGORY_ROUTE_ERROR:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code: 'CREATE_CATEGORY_FAILED',
        message: error.message || 'Failed to create table category'
      }
    });
  }
});

/**
 * PUT /api/reservations/categories/:id
 */
r.put('/categories/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    const category = await updateRoomCategory(req.params.id, req.body || {});
    return res.json({ ok: true, data: category });
  } catch (error) {
    console.error('UPDATE_CATEGORY_ROUTE_ERROR:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code: 'UPDATE_CATEGORY_FAILED',
        message: error.message || 'Failed to update table category'
      }
    });
  }
});

/**
 * DELETE /api/reservations/categories/:id
 */
r.delete('/categories/:id', authenticateToken, requireManager, async (req, res) => {
  try {
    await deleteRoomCategory(req.params.id);
    return res.json({ ok: true });
  } catch (error) {
    console.error('DELETE_CATEGORY_ROUTE_ERROR:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: {
        code: 'DELETE_CATEGORY_FAILED',
        message: error.message || 'Failed to delete table category'
      }
    });
  }
});

/**
 * POST /api/reservations/validate-promotion
 */
r.post('/validate-promotion', authenticateToken, async (req, res) => {
  try {
    const { code, user_id: targetUserId, booking_id: bookingId } = req.body || {};

    if (!code) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_CODE', message: 'Promotion code is required' }
      });
    }

    const userIdForValidation = targetUserId || req.user?.sub || null;

    if (!userIdForValidation) {
      return res.status(400).json({
        ok: false,
        error: { code: 'USER_REQUIRED', message: 'Customer selection is required before applying a promotion' }
      });
    }

    const result = await validatePromotion(code, userIdForValidation, { bookingId });

    if (!result.valid) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PROMOTION', message: result.message }
      });
    }

    return res.json({
      ok: true,
      data: result.promotion,
      message: result.message
    });
  } catch (error) {
    console.error('VALIDATE_PROMOTION_ERROR:', error);
    const status = error.statusCode || 500;
    const message = error.statusCode ? error.message : 'Failed to validate promotion';

    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'VALIDATION_FAILED', message }
    });
  }
});

/**
 * POST /api/reservations/promotions
 */
r.post('/promotions', authenticateToken, requireStaffOrManager, async (req, res) => {
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
    } = req.body;

    if (!name || !discount_type || discount_value === undefined || discount_value === null) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Name, discount_type, and discount_value are required' }
      });
    }

    const promotion = await createPromotion({
      name,
      discount_type,
      discount_value,
      description,
      start_date,
      end_date,
      max_uses,
      min_amount
    });

    return res.status(201).json({ ok: true, data: promotion });
  } catch (error) {
    console.error('CREATE_PROMOTION_ROUTE_ERROR:', error);
    const message = error.message || 'Failed to create promotion';

    return res.status(400).json({
      ok: false,
      error: { code: 'CREATE_PROMOTION_FAILED', message }
    });
  }
});


// ====================================
// 📅 BOOKING ROUTES (REQUIRES AUTH)
// ====================================

/**
 * GET /api/reservations
 */
r.get('/', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { status, date, tableId, userId, search, page = 1, limit = 20 } = req.query;

    const result = await getAllBookings({
      status,
      date,
      tableId,
      userId,
      search,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('GET_BOOKINGS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch bookings' }
    });
  }
});

/**
 * GET /api/reservations/my - ดูการจองของผู้ใช้ที่ล็อกอินอยู่
 */
r.get('/my', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10, upcomingOnly } = req.query;

    const result = await getBookingsForUser(req.user.sub, {
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10,
      upcomingOnly: String(upcomingOnly).toLowerCase() === 'true'
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('GET_MY_BOOKINGS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch your bookings' }
    });
  }
});

/**
 * POST /api/reservations
 */
r.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      user_id,
      table_id,
      booking_date,
      start_time,
      end_time,
      number_of_people: rawNumberOfPeople,
      special_requests,
      promotion_id,
      payment_type,
      total_amount
    } = req.body;

    if (!user_id || !table_id || !booking_date || !start_time || !end_time) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_FIELDS', message: 'Required fields are missing' }
      });
    }

    const parsedNumberOfPeople = (() => {
      if (rawNumberOfPeople === undefined || rawNumberOfPeople === null || rawNumberOfPeople === '') {
        return null;
      }

      const numericValue = Number(rawNumberOfPeople);
      return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
    })();

    const availableTables = await getAvailableTables(booking_date, start_time, end_time);
    const isTableAvailable = availableTables.some(t => t.id === table_id);

    if (!isTableAvailable) {
      return res.status(400).json({
        ok: false,
        error: { code: 'TABLE_UNAVAILABLE', message: 'Selected table is not available' }
      });
    }

    const normalizedPaymentType = payment_type && ['advance', 'walk_in'].includes(payment_type)
      ? payment_type
      : 'advance';

    const bookingPayload = {
      user_id,
      table_id,
      booking_date,
      start_time,
      end_time,
      special_requests,
      promotion_id,
      payment_type: normalizedPaymentType,
      total_amount: total_amount || 0,
      status: 'waiting'
    };

    if (parsedNumberOfPeople !== null) {
      bookingPayload.number_of_people = parsedNumberOfPeople;
    }

    const booking = await createBooking(bookingPayload);

    let paymentPlaceholder = null;
    let paymentPlaceholderError = null;

    try {
      if (booking) {
        const paymentPayload = (() => {
          const basePayload = {
            booking_id: booking.id,
            payment_method: 'bank_transfer'
          };

          if (booking.payment_type === 'walk_in' && booking.total_amount > 0) {
            return {
              ...basePayload,
              payment_type: 'full_payment',
              amount: Number(booking.total_amount),
              transaction_ref: `BOOK-${booking.id}-FULL-${Date.now()}`
            };
          }

          if (booking.payment_type !== 'walk_in' && booking.deposit_amount > 0) {
            return {
              ...basePayload,
              payment_type: 'deposit',
              amount: Number(booking.deposit_amount),
              transaction_ref: `BOOK-${booking.id}-DEP-${Date.now()}`
            };
          }

          return null;
        })();

        if (paymentPayload) {
          paymentPlaceholder = await createPayment(paymentPayload);
        }
      }
    } catch (error) {
      console.error('CREATE_BOOKING_PAYMENT_PLACEHOLDER_ERROR:', error);
      paymentPlaceholderError = 'Failed to prepare payment slip entry';
    }

    return res.status(201).json({
      ok: true,
      data: booking,
      ...(paymentPlaceholder && { payment_placeholder: paymentPlaceholder }),
      ...(paymentPlaceholderError && { payment_placeholder_error: paymentPlaceholderError }),
      message: paymentPlaceholder
        ? 'Booking created successfully and payment slip entry prepared'
        : 'Booking created successfully'
    });
  } catch (error) {
    console.error('CREATE_BOOKING_ERROR:', error);
    const status = error.statusCode || 500;
    const message = error.statusCode ? error.message : 'Failed to create booking';

    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'CREATE_FAILED', message }
    });
  }
});

/**
 * GET /api/reservations/:id - MUST BE LAST!
 */
r.get('/:id', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 GET /:id called with id:', req.params.id);
    const booking = await getBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Booking not found' }
      });
    }

    return res.json({ ok: true, data: booking });
  } catch (error) {
    console.error('GET_BOOKING_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch booking' }
    });
  }
});

/**
 * PUT /api/reservations/:id
 */
r.put('/:id', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const updates = {};
    const allowedFields = [
      'table_id', 'booking_date', 'start_time', 'end_time',
      'special_requests', 'promotion_id', 'total_amount'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.table_id || updates.booking_date || updates.start_time || updates.end_time) {
      const booking = await getBookingById(req.params.id);
      const checkDate = updates.booking_date || booking.booking_date;
      const checkStartTime = updates.start_time || booking.start_time;
      const checkEndTime = updates.end_time || booking.end_time;
      const checkTableId = updates.table_id || booking.table_id;

      const availableTables = await getAvailableTables(checkDate, checkStartTime, checkEndTime, req.params.id);
      const isTableAvailable = availableTables.some(t => t.id === checkTableId);

      if (!isTableAvailable) {
        return res.status(400).json({
          ok: false,
          error: { code: 'TABLE_UNAVAILABLE', message: 'Table is not available' }
        });
      }
    }

    const booking = await updateBooking(req.params.id, updates);

    return res.json({
      ok: true,
      data: booking,
      message: 'Booking updated successfully'
    });
  } catch (error) {
    console.error('UPDATE_BOOKING_ERROR:', error);
    const status = error.statusCode || 500;
    const message = error.statusCode ? error.message : 'Failed to update booking';

    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'UPDATE_FAILED', message }
    });
  }
});

/**
 * PATCH /api/reservations/:id/approve
 */
r.patch('/:id/approve', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const booking = await approveBooking(req.params.id, req.user.sub);
    return res.json({
      ok: true,
      data: booking,
      message: 'Booking approved'
    });
  } catch (error) {
    console.error('APPROVE_BOOKING_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'APPROVE_FAILED', message: 'Failed to approve' }
    });
  }
});

/**
 * PATCH /api/reservations/:id/reject
 */
r.patch('/:id/reject', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await rejectBooking(req.params.id, reason);
    return res.json({
      ok: true,
      data: booking,
      message: 'Booking rejected'
    });
  } catch (error) {
    console.error('REJECT_BOOKING_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'REJECT_FAILED', message: 'Failed to reject' }
    });
  }
});

/**
 * PATCH /api/reservations/:id/check-in
 */
r.patch('/:id/check-in', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const booking = await checkInBooking(req.params.id, req.user.sub);
    return res.json({
      ok: true,
      data: booking,
      message: 'Check-in successful'
    });
  } catch (error) {
    console.error('CHECK_IN_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'CHECK_IN_FAILED', message: 'Failed to check-in' }
    });
  }
});

/**
 * PATCH /api/reservations/:id/check-out
 */
r.patch('/:id/check-out', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const booking = await checkOutBooking(req.params.id);
    return res.json({
      ok: true,
      data: booking,
      message: 'Check-out successful'
    });
  } catch (error) {
    console.error('CHECK_OUT_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'CHECK_OUT_FAILED', message: 'Failed to check-out' }
    });
  }
});

/**
 * PATCH /api/reservations/:id/cancel
 */
r.patch('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const booking = await cancelBooking(req.params.id);
    return res.json({
      ok: true,
      data: booking,
      message: 'Booking cancelled'
    });
  } catch (error) {
    console.error('CANCEL_BOOKING_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'CANCEL_FAILED', message: 'Failed to cancel' }
    });
  }
});

/**
 * POST /api/reservations/:id/pay-deposit - จ่ายมัดจำ 10%
 */
r.post('/:id/pay-deposit', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const booking = await payDeposit(req.params.id);
    return res.json({
      ok: true,
      data: booking,
      message: 'Deposit paid successfully'
    });
  } catch (error) {
    console.error('PAY_DEPOSIT_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'PAYMENT_FAILED', message: 'Failed to process deposit payment' }
    });
  }
});

/**
 * POST /api/reservations/:id/pay-remaining - จ่ายส่วนที่เหลือ 90%
 */
r.post('/:id/pay-remaining', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const booking = await payRemaining(req.params.id);
    return res.json({
      ok: true,
      data: booking,
      message: 'Remaining amount paid successfully'
    });
  } catch (error) {
    console.error('PAY_REMAINING_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'PAYMENT_FAILED', message: 'Failed to process remaining payment' }
    });
  }
});

/**
 * POST /api/reservations/:id/pay-full - จ่ายเต็มจำนวน (Walk-in)
 */
r.post('/:id/pay-full', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const booking = await payFull(req.params.id);
    return res.json({
      ok: true,
      data: booking,
      message: 'Full payment completed successfully'
    });
  } catch (error) {
    console.error('PAY_FULL_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'PAYMENT_FAILED', message: 'Failed to process full payment' }
    });
  }
});



export default r;