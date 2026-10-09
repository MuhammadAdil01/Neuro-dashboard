import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  sub: string; // user id
  role: 'ADMIN' | 'USER';
  ver: number; // users.token_version at issue time
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'neurotask-api',
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_SECRET, { issuer: 'neurotask-api' }) as TokenPayload;
}

/** Converts "7d" / "12h" / "30m" / "3600" into milliseconds for the cookie maxAge. */
export function expiresInMs(value = env.JWT_EXPIRES_IN): number {
  const match = /^(\d+)\s*([smhd])?$/.exec(value.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = Number(match[1]);
  const unit = { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[(match[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
  return n * unit;
}
