import jwt from 'jsonwebtoken';

export function authenticateToken(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: { code: 'NO_TOKEN', message: 'Missing Bearer token' } });
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE
    });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: { code: 'INVALID_TOKEN', message: 'Token invalid/expired' } });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    }
    next();
  };
}


import { nanoid } from 'nanoid';

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m',
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE
    }
  );
}

export function signRefreshToken(user, jti) {
  return jwt.sign(
    { sub: user.id, jti },
    process.env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d',
      issuer: process.env.TOKEN_ISSUER,
      audience: process.env.TOKEN_AUDIENCE
    }
  );
}

export function newJti() { return nanoid(); }
