// A very small mock OAuth provider glue to demonstrate the flow without real Google credentials.
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import {findUserByEmail, createUser } from './db.js';
import bcrypt from 'bcryptjs';

// Simulated "authorization" endpoint: user clicks consent and we redirect with ?code=mockcode
export function oauthAuthorize(req, res) {
  const redirectUri = req.query.redirect_uri || '/oauth/callback';
  
  // In a real flow you would render a consent screen
  const code = 'mock-code-' + Math.random().toString(36).slice(2);

  // Store mapping code->email (simulate we got email from the provider after consent)
  const email = 'oauth_user@example.com';
  req.app.locals.oauthCodes = req.app.locals.oauthCodes || new Map();
  req.app.locals.oauthCodes.set(code, { email, ts: Date.now() });
  const url = new URL(redirectUri, `http://${req.headers.host}`);
  url.searchParams.set('code', code);
  return res.redirect(url.toString());
}

// Token exchange: client sends code, we return an "access token" (really we'll mint our JWT)
export function oauthToken(req, res) {
  const { code } = req.body || {};
  const store = req.app.locals.oauthCodes || new Map();
  const entry = store.get(code);
  if (!entry) return res.status(400).json({ ok: false, error: { code: 'BAD_CODE' }});

  let user = findUserByEmail(entry.email);
  if (!user) {
    user = createUser(entry.email, bcrypt.hashSync('oauth_dummy_password', 8), 'user');
  }
  const token = signAccessToken(user);
  return res.json({ ok: true, token, provider: 'mock-oauth', email: user.email });
}
