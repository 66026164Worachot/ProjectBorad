// routes/apiPaymentRoutes.js
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  getAllPayments,
  getPaymentsForUser,
  verifyPayment,
  rejectPayment,
  getPaymentStats,
  createPayment,
  getPaymentById,
  updatePayment
} from '../services/paymentService.js';
import { getBookingById } from '../services/reservationService.js';

const r = Router();

/**
 * Middleware: ตรวจสอบว่าเป็น staff หรือ manager เท่านั้น
 */
const requireStaffOrManager = (req, res, next) => {
  if (!['staff', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Staff or Manager access required' }
    });
  }
  next();
};

/**
 * GET /api/payments - ดึงรายการ payments ทั้งหมด
 * Access: staff, manager
 */
r.get('/', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { 
      status, 
      paymentType,
      search, 
      page = 1, 
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    const result = await getAllPayments({
      status,
      paymentType,
      search,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    });

    return res.json({ 
      ok: true, 
      data: result 
    });
  } catch (error) {
    console.error('GET_PAYMENTS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { 
        code: 'FETCH_FAILED', 
        message: 'Failed to fetch payments' 
      }
    });
  }
});

/**
 * GET /api/payments/stats - สถิติ payments
 * Access: staff, manager
 */
r.get('/stats', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const stats = await getPaymentStats();
    return res.json({ ok: true, data: stats });
  } catch (error) {
    console.error('GET_STATS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { 
        code: 'STATS_FAILED', 
        message: 'Failed to fetch stats' 
      }
    });
  }
});

/**
 * GET /api/payments/my - ดึงรายการชำระเงินของผู้ใช้ที่ล็อกอินอยู่
 */
r.get('/my', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const result = await getPaymentsForUser(req.user.sub, {
      status,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 10
    });

    return res.json({ ok: true, data: result });
  } catch (error) {
    console.error('GET_MY_PAYMENTS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: {
        code: 'FETCH_FAILED',
        message: 'Failed to fetch payments'
      }
    });
  }
});

/**
 * POST /api/payments - สร้าง payment ใหม่ (อัพโหลด slip)
 * Access: authenticated users
 */
r.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      booking_id,
      payment_type,
      amount,
      payment_method,
      slip_image_url,
      transaction_ref
    } = req.body;

    // Validation
    if (!booking_id || !payment_type || !amount) {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'MISSING_FIELDS', 
          message: 'booking_id, payment_type, and amount are required' 
        }
      });
    }

    // Validate payment_type
    if (!['deposit', 'remaining', 'full_payment'].includes(payment_type)) {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'INVALID_PAYMENT_TYPE', 
          message: 'payment_type must be: deposit, remaining, or full_payment' 
        }
      });
    }

    const booking = await getBookingById(booking_id);
    if (!booking || booking.user_id !== req.user.sub) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only upload payment slips for your own bookings'
        }
      });
    }

    const payload = {
      booking_id,
      payment_type,
      amount: parseFloat(amount),
      payment_method,
      slip_image_url,
      transaction_ref: transaction_ref || `BOOK-${booking_id}-${Date.now()}`,
      user_id: req.user.sub
    };

    const payment = await createPayment({
      ...payload
    });

    return res.status(201).json({
      ok: true,
      data: payment,
      message: 'Payment slip uploaded successfully. Waiting for verification.'
    });
  } catch (error) {
    console.error('CREATE_PAYMENT_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { 
        code: 'CREATE_FAILED', 
        message: 'Failed to create payment' 
      }
    });
  }
});

/**
 * PATCH /api/payments/:id - อัปเดตสลิปการชำระเงินของผู้ใช้เอง
 */
r.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const paymentId = req.params.id?.trim();

    if (!paymentId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PAYMENT_ID', message: 'Payment ID is required' }
      });
    }

    const uuidV4Regex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidV4Regex.test(paymentId)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PAYMENT_ID', message: 'Payment ID is invalid' }
      });
    }

    const rawBookingId = req.body?.booking_id || req.body?.bookingId;
    const bookingId = typeof rawBookingId === 'string' ? rawBookingId.trim() : '';

    if (!bookingId) {
      return res.status(400).json({
        ok: false,
        error: { code: 'BOOKING_ID_REQUIRED', message: 'booking_id is required to update the payment' }
      });
    }

    if (!uuidV4Regex.test(bookingId)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_BOOKING_ID', message: 'booking_id is invalid' }
      });
    }

    const booking = await getBookingById(bookingId);

    if (!booking || booking.user_id !== req.user.sub) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'You can only update payments for your own bookings' }
      });
    }

    const existingPayment = await getPaymentById(paymentId, {
      bookingId,
      paymentType: 'deposit'
    });

    if (!existingPayment) {
      return res.status(404).json({
        ok: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found' }
      });
    }

    if (existingPayment.payment_type !== 'deposit') {
      return res.status(400).json({
        ok: false,
        error: { code: 'UNSUPPORTED_OPERATION', message: 'Only deposit payments can be updated' }
      });
    }

    if (existingPayment.payment_status === 'verified') {
      return res.status(400).json({
        ok: false,
        error: { code: 'PAYMENT_ALREADY_VERIFIED', message: 'Verified payments cannot be updated' }
      });
    }

    const {
      amount,
      payment_method,
      slip_image_url,
      transaction_ref
    } = req.body || {};

    if (!slip_image_url) {
      return res.status(400).json({
        ok: false,
        error: { code: 'MISSING_SLIP', message: 'slip_image_url is required' }
      });
    }

    const parsedAmount = amount !== undefined && amount !== null ? Number.parseFloat(amount) : existingPayment.amount;
    const normalizedAmount = Number.isFinite(parsedAmount) ? parsedAmount : existingPayment.amount;

    if (existingPayment.id && existingPayment.id !== paymentId) {
      console.warn('PAYMENT_ID_MISMATCH_FALLBACK:', {
        requestedId: paymentId,
        resolvedId: existingPayment.id,
        bookingId
      });
    }

    const fallbackBookingId = existingPayment.booking_id || bookingId;

    const updatePayload = {
      amount: normalizedAmount,
      payment_method: payment_method || existingPayment.payment_method,
      slip_image_url,
      transaction_ref:
        transaction_ref ||
        existingPayment.transaction_ref ||
        `BOOK-${fallbackBookingId}-${Date.now()}`
    };

    const updatedPayment = await updatePayment(paymentId, updatePayload, {
      bookingId,
      paymentType: existingPayment.payment_type,
      userId: req.user.sub,
      currentSlipUrl: existingPayment.slip_image_url
    });

    if (!updatedPayment) {
      return res.status(404).json({
        ok: false,
        error: { code: 'PAYMENT_NOT_FOUND', message: 'Payment not found for this booking' }
      });
    }

    const responseBooking = existingPayment.booking || booking;
    const responseData = {
      ...updatedPayment,
      booking: responseBooking,
      booking_id: fallbackBookingId
    };

    return res.json({
      ok: true,
      data: responseData,
      message: 'Payment slip updated successfully. Waiting for verification.'
    });
  } catch (error) {
    console.error('UPDATE_PAYMENT_ROUTE_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'Failed to update payment' }
    });
  }
});

/**
 * PATCH /api/payments/:id/verify - ยืนยัน payment (approve slip)
 * Access: staff, manager
 */
r.patch('/:id/verify', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const payment = await verifyPayment(req.params.id, req.user.sub);
    
    return res.json({
      ok: true,
      data: payment,
      message: 'Payment verified successfully'
    });
  } catch (error) {
    console.error('VERIFY_PAYMENT_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { 
        code: 'VERIFY_FAILED', 
        message: 'Failed to verify payment' 
      }
    });
  }
});

/**
 * PATCH /api/payments/:id/reject - ปฏิเสธ payment
 * Access: staff, manager
 */
r.patch('/:id/reject', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        ok: false,
        error: { 
          code: 'MISSING_REASON', 
          message: 'Rejection reason is required' 
        }
      });
    }

    const payment = await rejectPayment(req.params.id, reason);
    
    return res.json({
      ok: true,
      data: payment,
      message: 'Payment rejected'
    });
  } catch (error) {
    console.error('REJECT_PAYMENT_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { 
        code: 'REJECT_FAILED', 
        message: 'Failed to reject payment' 
      }
    });
  }
});

export default r;
