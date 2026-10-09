import { z } from 'zod';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ApiError } from './api';

/** Maps backend 422 field errors onto react-hook-form fields. Returns true when at least one was applied. */
export function applyServerErrors<T extends FieldValues>(err: ApiError, setError: UseFormSetError<T>): boolean {
  if (err.status !== 422 || !err.details?.length) return false;
  let applied = false;
  for (const d of err.details) {
    if (d.field) {
      setError(d.field as Path<T>, { type: 'server', message: d.message });
      applied = true;
    }
  }
  return applied;
}

export const passwordRules = {
  min: 8,
  checks: [
    { test: (p: string) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p: string) => /[a-z]/.test(p), label: 'A lowercase letter' },
    { test: (p: string) => /[A-Z]/.test(p), label: 'An uppercase letter' },
    { test: (p: string) => /\d/.test(p), label: 'A number' },
  ],
};

/** Mirrors the backend password policy so users get instant feedback. */
export const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/\d/, 'Password must contain a number');
