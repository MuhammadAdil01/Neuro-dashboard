'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';

const schema = z.object({ email: z.string().trim().email('Enter a valid email address') });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<{ message: string; devResetUrl?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      setResult(await api.post('/auth/forgot-password', values));
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  if (result) {
    return (
      <div className="text-center" role="status">
        <MailCheck className="mx-auto h-10 w-10 text-primary" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-fg">Check your email</h1>
        <p className="mt-2 text-sm text-muted">{result.message} The link expires in 30 minutes.</p>
        {result.devResetUrl && (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-surface-2 p-3 text-left text-xs text-muted">
            <p className="font-semibold text-fg">Development mode</p>
            <p className="mt-1">Email is not configured, so here is your reset link:</p>
            <a href={result.devResetUrl} className="mt-2 block break-all font-medium text-primary hover:underline">
              Open reset link
            </a>
          </div>
        )}
        <Link href="/login" className="mt-8 inline-block text-sm font-medium text-primary hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-fg">Forgot your password?</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and we’ll send you a secure, single-use reset link.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </div>
        )}
        <Input label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
