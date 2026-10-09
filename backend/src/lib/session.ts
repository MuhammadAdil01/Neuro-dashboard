import type { Response } from 'express';
import { env, isProd } from '../config/env';
import { expiresInMs, signToken } from './jwt';

const cookieOptions = () => ({
  httpOnly: true, // not readable from JavaScript, so XSS cannot steal it
  secure: isProd, // HTTPS only in production
  sameSite: 'lax' as const, // the Next.js frontend proxies /api, so requests are same-site
  path: '/',
});

/** Signs a JWT for the user and stores it in the session cookie. Returns the token for non-browser clients. */
export function startSession(res: Response, user: { id: string; tokenVersion: number; role: { name: 'ADMIN' | 'USER' } }) {
  const token = signToken({ sub: user.id, role: user.role.name, ver: user.tokenVersion });
  res.cookie(env.COOKIE_NAME, token, { ...cookieOptions(), maxAge: expiresInMs() });
  return token;
}

export function endSession(res: Response) {
  res.clearCookie(env.COOKIE_NAME, cookieOptions());
}
