import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from './errorHandler.js';
import { User } from '../models/User.js';

const COOKIE_NAME = 'url_shortener_session';
const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function secret() {
  if (env.jwtSecret.length < 32 || env.jwtSecret.startsWith('replace-with-')) {
    throw new Error('Set a random JWT_SECRET (at least 32 characters) in backend/.env');
  }
  return env.jwtSecret;
}

export function readCookie(req, name = COOKIE_NAME) {
  const raw = req.headers.cookie || '';
  const entry = raw.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return null; }
}

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.nodeEnv === 'production' || env.cookieSameSite === 'none',
  sameSite: env.cookieSameSite,
  path: '/',
  maxAge: SESSION_AGE_MS
});

export function setSession(res, userId) {
  const token = jwt.sign({ sub: userId }, secret(), { algorithm: 'HS256', expiresIn: '7d' });
  res.cookie(COOKIE_NAME, token, cookieOptions());
}
export function clearSession(res) {
  const { maxAge, ...options } = cookieOptions();
  res.clearCookie(COOKIE_NAME, options);
}
export async function requireAuth(req, _res, next) {
  try {
    const token = readCookie(req);
    if (!token) throw new AppError(401, 'Authentication required');
    let payload;
    try { payload = jwt.verify(token, secret(), { algorithms: ['HS256'] }); }
    catch { throw new AppError(401, 'Invalid or expired session'); }
    if (!payload.sub || typeof payload.sub !== 'string') throw new AppError(401, 'Invalid session');
    const user = await User.findById(payload.sub);
    if (!user) throw new AppError(401, 'Account not found');
    req.user = user;
    next();
  } catch (error) { next(error); }
}
