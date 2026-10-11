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

type SessionUser = { id: string; email: string; name: string; status: 'ACTIVE' | 'INACTIVE'; tokenVersion: number; role: { name: 'ADMIN' | 'USER' } };

// Each DB round trip to Supabase costs ~200ms, so the per-request user lookup is cached briefly.
// Every write that changes status, role, token_version or the account itself calls forgetSessionUser().
const SESSION_CACHE_MS = 30_000;
const sessionCache = new Map<string, { user: SessionUser; at: number }>();

export function forgetSessionUser(userId: string) {
  sessionCache.delete(userId);
}

async function loadSessionUser(id: string): Promise<SessionUser | null> {
  const hit = sessionCache.get(id);
  if (hit && Date.now() - hit.at < SESSION_CACHE_MS) return hit.user;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, status: true, tokenVersion: true, role: { select: { name: true } } },
  });
  if (sessionCache.size > 10_000) sessionCache.clear();
  if (user) sessionCache.set(id, { user, at: Date.now() });
  else sessionCache.delete(id);
  return user;
}

/**
 * Verifies the JWT, then re-checks the user (cached for 30s) so deactivated
 * accounts, role changes and revoked tokens (token_version) take effect.
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
    let user = await loadSessionUser(payload.sub);
    if (user && user.tokenVersion !== payload.ver) {
      forgetSessionUser(payload.sub); // the cache may be older than this token
      user = await loadSessionUser(payload.sub);
    }
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
