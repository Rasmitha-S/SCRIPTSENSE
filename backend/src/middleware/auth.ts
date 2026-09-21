import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { queryOne } from '../database/index.js';
import { User, TokenPayload } from '../types/index.js';

dotenv.config();

export const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'scriptsense_super_secret_jwt_key_2026_educator_token';
export const ACCESS_TOKEN_EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '1440', 10);

// Extend Express Request type to include user
export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function verifyPassword(plain: string, hashed: string): boolean {
  try {
    return bcrypt.compareSync(plain, hashed);
  } catch (e) {
    return false;
  }
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}

export function createAccessToken(data: { sub: string; role: string; user_id: number }): string {
  return jwt.sign(data, SECRET_KEY, {
    expiresIn: `${ACCESS_TOKEN_EXPIRE_MINUTES}m`,
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Could not validate credentials or token expired' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, SECRET_KEY) as TokenPayload;
    if (!payload || !payload.sub) {
      res.status(401).json({ detail: 'Could not validate credentials or token expired' });
      return;
    }

    const user = queryOne<User>('SELECT * FROM users WHERE username = ? LIMIT 1', payload.sub);
    if (!user) {
      res.status(401).json({ detail: 'User account not found' });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({ detail: 'Account has been deactivated. Please contact an administrator.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ detail: 'Could not validate credentials or token expired' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({
        detail: 'Administrator access required. You do not have permission to view or manage admin data.'
      });
      return;
    }
    next();
  });
}
