// routes/apiAuthRoutes.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { signAccessToken, signRefreshToken, newJti } from '../middleware/authMiddleware.js';
import {
  findUserByEmail,
  createUser,
  findUserById,
  updateUserPassword,
  storeRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  clearPasswordResetTokensForUser,
  createPasswordResetToken,
  findActivePasswordResetToken,
  incrementPasswordResetAttempts,
  consumePasswordResetToken,
  deletePasswordResetToken
} from '../services/db.js';
import { OAuth2Client } from 'google-auth-library';
import { sendPasswordResetCodeEmail } from '../services/email.js';


const r = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);


/**
 * Helpers
 */
function requireJson(req, res, next) {
  if (req.is('application/json') || typeof req.body === 'object') return next();
  return res.status(400).json({ ok: false, error: { code: 'BAD_JSON', message: 'Content-Type must be application/json' } });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isGmail(email) {
  return /^[^@\s]+@gmail\.com$/i.test(email);
}

/**
 * POST /api/auth/register
 * body: { email, password }
 */

r.post('/register', requireJson, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || String(password).length < 6) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_INPUT', message: 'email and password>=6 required' } });
  }
  try {
    const hash = await bcrypt.hash(password, 8);
    const user = await createUser(String(email).toLowerCase(), hash, 'user');
    return res.json({ ok: true, data: { id: user.id, email: user.email } });
  } catch (e) {
    if (e.code === 'E_DUP') {
      return res.status(409).json({ ok: false, error: { code: 'EMAIL_EXISTS', message: 'email already registered' } });
    }
    console.error('REGISTER_FAILED', e);
    return res.status(500).json({ ok: false, error: { code: 'REGISTER_FAILED' } });
  }
});

/**
 * POST /api/auth/login
 * body: { email, password }
 */

r.post('/login', requireJson, async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS' } });

    // รองรับทั้ง field: password_hash (Supabase) และ passwordHash (in-memory)
    const hash = user.password_hash || user.passwordHash;
    const ok = await bcrypt.compare(String(password || ''), String(hash || ''));
    if (!ok) return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS' } });

    const access = signAccessToken({ id: user.id, email: user.email, role: user.role });
    const jti = newJti();
    const refresh = signRefreshToken({ id: user.id }, jti);

    // เก็บ refresh token ไว้ใน store/DB (7 วันตาม .env)
    const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    await storeRefreshToken(jti, user.id, expMs);

    return res.json({ ok: true, tokens: { access, refresh } });
  } catch (e) {
    console.error('LOGIN_FAILED', e);
    return res.status(500).json({ ok: false, error: { code: 'LOGIN_FAILED' } });
  }
});

/**
 * POST /api/auth/refresh
 * body: { refreshToken }
 */
r.post('/refresh', requireJson, async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(400).json({ ok: false, error: { code: 'NO_REFRESH' } });

  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE
    });

    const entry = await getRefreshToken(payload.jti);
    if (!entry) return res.status(401).json({ ok: false, error: { code: 'REFRESH_REVOKED' } });

    // Supabase version uses user_id, in-memory may use userId
    const userId = entry.user_id ?? entry.userId;
    const expAt = new Date(entry.expires_at || entry.expiresAt).getTime();
    if (userId !== payload.sub || expAt < Date.now()) {
      return res.status(401).json({ ok: false, error: { code: 'REFRESH_REVOKED' } });
    }

    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ ok: false, error: { code: 'REFRESH_REVOKED' } });

    const access = signAccessToken({ id: user.id, email: user.email, role: user.role });
    return res.json({ ok: true, tokens: { access } });
  } catch (e) {
    return res.status(401).json({ ok: false, error: { code: 'INVALID_REFRESH' } });
  }
});

/**
 * POST /api/auth/logout
 * body: { refreshToken }
 * - revoke refresh token
 */
r.post('/logout', requireJson, async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.json({ ok: true });
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE
    });
    await revokeRefreshToken(payload.jti);
  } catch (_) { /* ignore */ }
  return res.json({ ok: true });
});

/**
 * POST /api/auth/reset/request
 * body: { email }
 */
r.post('/reset/request', requireJson, async (req, res) => {
  const { email } = req.body || {};
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return res.status(400).json({ ok: false, error: { code: 'EMAIL_REQUIRED', message: 'Email is required.' } });
  }

  if (!isGmail(normalized)) {
    return res.status(400).json({ ok: false, error: { code: 'GMAIL_ONLY', message: 'ระบบรองรับเฉพาะ Gmail ในการรีเซ็ตรหัสผ่านชั่วคราว' } });
  }

  const genericMessage = 'ถ้าอีเมลนี้อยู่ในระบบ เราได้ส่งรหัสยืนยันไปให้แล้ว';

  try {
    const user = await findUserByEmail(normalized);
    if (!user) {
      return res.json({ ok: true, message: genericMessage });
    }

    await clearPasswordResetTokensForUser(user.id);

    const code = String(crypto.randomInt(100000, 1000000));
    const hash = await bcrypt.hash(code, 8);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 นาที

    await createPasswordResetToken(user.id, hash, expiresAt);
    await sendPasswordResetCodeEmail(user.email, code);

    return res.json({ ok: true, message: genericMessage, expiresIn: 600 });
  } catch (error) {
    if (error.code === 'EMAIL_NOT_CONFIGURED') {
      return res.status(500).json({ ok: false, error: { code: 'EMAIL_NOT_CONFIGURED', message: 'ระบบยังไม่ได้ตั้งค่าอีเมลสำหรับส่งรหัสยืนยัน' } });
    }

    console.error('RESET_REQUEST_FAILED', error);
    return res.status(500).json({ ok: false, error: { code: 'RESET_REQUEST_FAILED', message: 'ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง' } });
  }
});

/**
 * POST /api/auth/reset/confirm
 * body: { email, code, newPassword }
 */
r.post('/reset/confirm', requireJson, async (req, res) => {
  const { email, code, newPassword } = req.body || {};
  const normalized = normalizeEmail(email);

  if (!normalized || !code || !newPassword) {
    return res.status(400).json({ ok: false, error: { code: 'BAD_INPUT', message: 'Email, code และรหัสผ่านใหม่จำเป็นต้องกรอกให้ครบ' } });
  }

  if (!isGmail(normalized)) {
    return res.status(400).json({ ok: false, error: { code: 'GMAIL_ONLY', message: 'รีเซ็ตรหัสผ่านรองรับเฉพาะ Gmail เท่านั้น' } });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ ok: false, error: { code: 'PASSWORD_TOO_SHORT', message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' } });
  }

  try {
    const user = await findUserByEmail(normalized);
    if (!user) {
      return res.status(400).json({ ok: false, error: { code: 'INVALID_RESET', message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ' } });
    }

    const token = await findActivePasswordResetToken(user.id);
    if (!token) {
      return res.status(400).json({ ok: false, error: { code: 'TOKEN_EXPIRED', message: 'รหัสยืนยันไม่ถูกต้องหรือหมดอายุ' } });
    }

    const matches = await bcrypt.compare(String(code), token.code_hash);
    if (!matches) {
      const attempts = await incrementPasswordResetAttempts(token.id, token.attempts);
      if (attempts >= 5) {
        await deletePasswordResetToken(token.id);
      }
      return res.status(400).json({ ok: false, error: { code: 'CODE_MISMATCH', message: 'รหัสยืนยันไม่ถูกต้อง' } });
    }

    const newHash = await bcrypt.hash(String(newPassword), 8);
    await updateUserPassword(user.id, newHash);
    await consumePasswordResetToken(token.id);

    return res.json({ ok: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('RESET_CONFIRM_FAILED', error);
    return res.status(500).json({ ok: false, error: { code: 'RESET_CONFIRM_FAILED', message: 'ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง' } });
  }
});

r.get('/google', (req, res) => {
  const scope = ['openid', 'email', 'profile'].join(' ');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent'
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

r.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });
  // const { id_token } = await tokenResp.json();

  // verify id_token
  const tokenData = await tokenResp.json();
console.log('Google token response:', tokenData);

const { id_token } = tokenData;
if (!id_token) {
  return res.status(400).json({ ok: false, error: 'NO_ID_TOKEN', data: tokenData });
}

// verify id_token
const ticket = await googleClient.verifyIdToken({
  idToken: id_token,
  audience: process.env.GOOGLE_CLIENT_ID
});

const payload = ticket.getPayload(); // { email, name, picture, sub }
  // หา/สร้าง user ใน DB (Supabase version expects: createUser(email, passwordHash, role))
  let user = await findUserByEmail(payload.email);
  if (!user) {
    // สร้างรหัสผ่านปลอมสำหรับบัญชีที่สมัครผ่าน Google (ไม่ใช้ล็อกอินด้วยรหัสผ่าน)
    const fakeHash = await bcrypt.hash('google:' + payload.sub, 8);
    user = await createUser(String(payload.email).toLowerCase(), fakeHash, 'user');
  }

  // ออก JWT ของระบบเรา + เก็บ refresh token ให้ครบ (7 วัน)
  const jti = newJti();
  const access = signAccessToken({ id: user.id, email: user.email, role: user.role });
  const refresh = signRefreshToken({ id: user.id }, jti);
  const expMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await storeRefreshToken(jti, user.id, expMs);

  // redirect กลับ frontend พร้อม JWT (ผ่าน URL hash)
  const u = new URL(process.env.PUBLIC_WEB_URL || 'http://127.0.0.1:5500/public/login.html');
  u.hash = new URLSearchParams({ access, refresh }).toString();
  return res.redirect(u.toString());
});


export default r;
