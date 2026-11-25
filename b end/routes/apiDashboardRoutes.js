// routes/apiDashboardRoutes.js
import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { getDashboardStats } from '../services/dashboardService.js';

const r = Router();

/**
 * Middleware: ตรวจสอบว่าเป็น staff หรือ manager
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
 * GET /api/dashboard/stats
 * Query params: period (today/week/month)
 */
r.get('/stats', authenticateToken, requireStaffOrManager, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const userRole = req.user.role;

    if (!['today', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PERIOD', message: 'Period must be: today, week, or month' }
      });
    }

    const stats = await getDashboardStats(period, userRole);

    return res.json({
      ok: true,
      data: stats
    });
  } catch (error) {
    console.error('GET_DASHBOARD_STATS_ERROR:', error);
    return res.status(500).json({
      ok: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch dashboard stats' }
    });
  }
});

export default r;
