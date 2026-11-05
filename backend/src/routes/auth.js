import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';
import { requireAuth, setSession, clearSession } from '../middleware/auth.js';

export const authRouter = Router();
const usernamePattern = /^[a-zA-Z0-9_.-]{3,64}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;
const publicUser = (row) => ({ id: row.id, username: row.username, createdAt: row.created_at });
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

authRouter.post('/register', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || !usernamePattern.test(username.trim())) {
    throw new AppError(400, 'Username must be 3-64 characters (letters, digits, _, ., -)');
  }
  if (typeof password !== 'string' || !passwordPattern.test(password)) {
    throw new AppError(400, 'Password must be 8-64 characters with uppercase, lowercase and a number');
  }
  const normalized = username.trim();
  if (await User.findByUsername(normalized)) throw new AppError(409, 'Username already exists');
  const hash = await bcrypt.hash(password, 12);
  let user;
  try { user = await User.create(normalized, hash); }
  catch (error) {
    if (error.code === '23505') throw new AppError(409, 'Username already exists');
    throw error;
  }
  res.status(201).json({ user: publicUser(user), message: 'Account created' });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') throw new AppError(400, 'Username and password are required');
  const user = await User.findByUsername(username.trim());
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new AppError(401, 'Invalid username or password');
  }
  setSession(res, user.id);
  res.json({ user: publicUser(user) });
}));

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
authRouter.post('/logout', (_req, res) => { clearSession(res); res.json({ message: 'Logged out' }); });
