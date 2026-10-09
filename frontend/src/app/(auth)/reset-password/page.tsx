'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import { strongPassword } from '@/lib/forms';

const schema = z
  .object({ password: strongPassword, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Values = z.infer<typeof schema>;

function ResetForm() {
  const token = useSearchParams().get('token');
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg">Invalid reset link</h1>
        <p className="mt-2 text-sm text-muted">This link is missing its token. Request a new one.</p>
        <ButtonLink href="/forgot-password" className="mt-6">
          Request new link
        </ButtonLink>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-fg">Password updated</h1>
        <p className="mt-2 text-sm text-muted">For your security, all existing sessions were signed out.</p>
        <ButtonLink href="/login" className="mt-6">
          Log in
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-fg">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted">Make it strong and unique.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}{' '}
            <Link href="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          </div>
        )}
        <Input label="New password" type="password" autoComplete="new-password" {...register('password')} error={formState.errors.password?.message} />
        <PasswordChecklist value={watch('password') ?? ''} />
        <Input label="Confirm password" type="password" autoComplete="new-password" {...register('confirm')} error={formState.errors.confirm?.message} />
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Reset password
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
