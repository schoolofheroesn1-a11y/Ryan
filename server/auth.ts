import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { get, run, all } from './db';

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'teacher';
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const SESSION_DAYS = 30;
export const COOKIE = 'sid';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(res: Response, userId: number) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  run('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', token, userId, expires.toISOString());
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    expires,
  });
}

export function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  res.clearCookie(COOKIE);
}

export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    const user = get<User>(
      `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`,
      token,
      new Date().toISOString(),
    );
    if (user) req.user = user;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Требуется вход в систему' });
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Доступно только администрации' });
  next();
}

/** IDs of classes the user can access; null means "all classes" (admin). */
export function accessibleClassIds(user: User): number[] | null {
  if (user.role === 'admin') return null;
  return all<{ class_id: number }>('SELECT class_id FROM class_teachers WHERE user_id = ?', user.id).map((r) => r.class_id);
}

export function canAccessClass(user: User, classId: number | null): boolean {
  const ids = accessibleClassIds(user);
  if (ids === null) return true;
  return classId !== null && ids.includes(classId);
}

export function canAccessStudent(user: User, studentId: number): boolean {
  const s = get<{ class_id: number | null }>('SELECT class_id FROM students WHERE id = ?', studentId);
  if (!s) return false;
  return canAccessClass(user, s.class_id);
}
