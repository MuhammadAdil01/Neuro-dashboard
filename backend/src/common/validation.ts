import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number');

export const nameSchema = z.string().trim().min(2, 'Name must be at least 2 characters').max(100);

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #6366f1');

/** Strips control characters; the frontend renders text through React (auto-escaped), so HTML is never injected. */
export const cleanText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''));

/** Optional text that turns "" into null so it can clear a field. */
export const optionalText = (max: number) =>
  z
    .union([cleanText(max), z.null()])
    .optional()
    .transform((v) => (v === '' ? null : v));

/** ISO date string or null. null/'' must be matched before coercion (z.coerce.date() turns null into 1970-01-01). */
export const optionalDate = z
  .union([z.null(), z.literal(''), z.coerce.date()])
  .optional()
  .transform((v) => (v === '' ? null : v));

export const booleanQuery = z
  .enum(['true', 'false'])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'));
