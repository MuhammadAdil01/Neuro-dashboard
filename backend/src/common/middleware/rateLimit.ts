import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { isTest } from '../../config/env';

const handler = (_req: Request, res: Response) =>
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
  });

// Disabled in tests unless a test explicitly opts in to exercise the limiter
const skip = () => isTest && process.env.RATE_LIMIT_IN_TESTS !== 'true';
const common = { standardHeaders: 'draft-7' as const, legacyHeaders: false, handler, skip };

/** Brute-force protection for login / register. */
export const authLimiter = rateLimit({ ...common, windowMs: 15 * 60 * 1000, limit: 20 });

/** Stricter limit for endpoints that send email or accept anonymous input. */
export const sensitiveLimiter = rateLimit({ ...common, windowMs: 60 * 60 * 1000, limit: 5 });

/** General API limit. */
export const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 300 });
