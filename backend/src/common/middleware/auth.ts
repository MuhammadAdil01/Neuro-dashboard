import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { verifyToken } from '../../lib/jwt';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../errors';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  return req.cookies?.[env.COOKIE_NAME] ?? null;
}

/**
 * Verifies the JWT, then re-checks the user in the database so deactivated
 * accounts, role changes and revoked tokens (token_version) take effect immediately.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized());

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return next(ApiError.unauthorized('Session expired or invalid. Please log in again.'));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, status: true, tokenVersion: true, role: { select: { name: true } } },
    });
    if (!user || user.tokenVersion !== payload.ver) {
      return next(ApiError.unauthorized('Session expired or invalid. Please log in again.'));
    }
    if (user.status !== 'ACTIVE') return next(ApiError.forbidden('This account has been deactivated'));

    req.user = { id: user.id, email: user.email, name: user.name, role: user.role.name };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Array<'ADMIN' | 'USER'>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
