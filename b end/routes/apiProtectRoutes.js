import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../middleware/authMiddleware.js';
import {
  findUserById,
  findUserAuthById,
  updateUserProfile,
  updateUserPassword,
  revokeRefreshTokensForUser,
  deleteUser
} from '../services/db.js';

const r = Router();

const requireJson = (req, res, next) => {
  if (req.is('application/json') || typeof req.body === 'object') {
    return next();
  }
  return res.status(400).json({ ok: false, error: { code: 'BAD_JSON', message: 'Content-Type must be application/json' } });
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// =========================
// Account settings endpoints
// =========================

r.get('/me/profile', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.sub);
    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    return res.json({ ok: true, data: { user } });
  } catch (error) {
    console.error('GET_PROFILE_ERROR:', error);
    return res.status(500).json({ ok: false, error: { code: 'PROFILE_FAILED', message: 'Failed to load profile' } });
  }
});

r.put('/me/profile', authenticateToken, requireJson, async (req, res) => {
  try {
    const { fullName, email, phone } = req.body || {};
    const errors = {};

    if (!fullName || !String(fullName).trim()) {
      errors.fullName = 'Full name is required';
    }

    if (!email || !emailRegex.test(String(email))) {
      errors.email = 'Valid email is required';
    }

    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const cleaned = String(phone).replace(/[^0-9+\-\s]/g, '');
      if (cleaned.length < 6) {
        errors.phone = 'Phone number is too short';
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid profile data',
          details: errors
        }
      });
    }

    const updates = {
      full_name: String(fullName).trim(),
      email: String(email).toLowerCase(),
      phone: phone && String(phone).trim() !== '' ? String(phone).trim() : null
    };

    const updatedUser = await updateUserProfile(req.user.sub, updates);

    return res.json({
      ok: true,
      data: { user: updatedUser },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('UPDATE_PROFILE_ERROR:', error);
    if (error.code === '23505') {
      return res.status(409).json({
        ok: false,
        error: { code: 'EMAIL_EXISTS', message: 'Email already in use' }
      });
    }
    return res.status(500).json({ ok: false, error: { code: 'UPDATE_PROFILE_FAILED', message: 'Failed to update profile' } });
  }
});

r.put('/me/password', authenticateToken, requireJson, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'Current and new password are required' }
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        ok: false,
        error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 8 characters' }
      });
    }

    const user = await findUserAuthById(req.user.sub);
    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const ok = await bcrypt.compare(String(currentPassword), String(user.password_hash || ''));
    if (!ok) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_CURRENT_PASSWORD', message: 'Current password is incorrect' }
      });
    }

    const hash = await bcrypt.hash(String(newPassword), 10);
    await updateUserPassword(req.user.sub, hash);
    await revokeRefreshTokensForUser(req.user.sub);

    return res.json({ ok: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('CHANGE_PASSWORD_ERROR:', error);
    return res.status(500).json({ ok: false, error: { code: 'CHANGE_PASSWORD_FAILED', message: 'Failed to change password' } });
  }
});

r.post('/me/logout-others', authenticateToken, requireJson, async (req, res) => {
  try {
    const { password, currentRefreshToken } = req.body || {};
    if (!password) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_FAILED', message: 'Password is required' }
      });
    }

    const user = await findUserAuthById(req.user.sub);
    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const ok = await bcrypt.compare(String(password), String(user.password_hash || ''));
    if (!ok) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' }
      });
    }

    let keepJti = null;
    if (currentRefreshToken) {
      try {
        const payload = jwt.verify(String(currentRefreshToken), process.env.JWT_SECRET, {
          algorithms: ['HS256'],
          issuer: process.env.TOKEN_ISSUER,
          audience: process.env.TOKEN_AUDIENCE
        });
        if (payload.sub !== req.user.sub) {
          return res.status(400).json({
            ok: false,
            error: { code: 'INVALID_REFRESH', message: 'Refresh token does not belong to this user' }
          });
        }
        keepJti = payload.jti || null;
      } catch (err) {
        return res.status(400).json({
          ok: false,
          error: { code: 'INVALID_REFRESH', message: 'Invalid refresh token supplied' }
        });
      }
    }

    await revokeRefreshTokensForUser(req.user.sub, keepJti);

    return res.json({ ok: true, message: 'Logged out of other sessions successfully' });
  } catch (error) {
    console.error('LOGOUT_OTHERS_ERROR:', error);
    return res.status(500).json({ ok: false, error: { code: 'LOGOUT_OTHERS_FAILED', message: 'Failed to log out other sessions' } });
  }
});

r.delete('/me', authenticateToken, requireJson, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ ok: false, error: { code: 'VALIDATION_FAILED', message: 'Password is required' } });
    }

    const user = await findUserAuthById(req.user.sub);
    if (!user) {
      return res.status(404).json({ ok: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    }

    const ok = await bcrypt.compare(String(password), String(user.password_hash || ''));
    if (!ok) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_PASSWORD', message: 'Password is incorrect' }
      });
    }

    await deleteUser(req.user.sub);
    await revokeRefreshTokensForUser(req.user.sub);

    return res.json({ ok: true, message: 'Account deleted successfully' });
  } catch (error) {
    console.error('DELETE_ACCOUNT_ERROR:', error);

    if (error.code === 'HAS_RELATIONS') {
      return res.status(400).json({
        ok: false,
        error: { code: 'HAS_RELATIONS', message: error.message }
      });
    }

    if (error.code === '23503') {
      return res.status(400).json({
        ok: false,
        error: { code: 'FOREIGN_KEY_VIOLATION', message: 'Cannot delete account with related records' }
      });
    }

    return res.status(500).json({ ok: false, error: { code: 'DELETE_ACCOUNT_FAILED', message: 'Failed to delete account' } });
  }
});

export default r;
