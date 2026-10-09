'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR, { useSWRConfig } from 'swr';
import { z } from 'zod';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors, strongPassword } from '@/lib/forms';
import type { PublicSettings, User } from '@/lib/types';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Enter a valid email address'),
    password: strongPassword,
    confirm: z.string(),
    terms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms to continue' }) }),
  })
  .refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const { data: publicSettings } = useSWR<PublicSettings>('/public/settings');
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: '' } });
  const { register, handleSubmit, formState, watch } = form;

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFormError(null);
    try {
      const { user } = await api.post<{ user: User }>('/auth/register', {
        name,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      await mutate('/users/me', user, { revalidate: false });
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) setFormError(errorMessage(err));
    }
  });

  if (publicSettings && !publicSettings.allowRegistration) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-fg">Registration is closed</h1>
        <p className="mt-2 text-sm text-muted">New sign-ups are temporarily disabled. Please check back later.</p>
        <Link href="/login" className="mt-6 inline-block font-medium text-primary hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-fg">Create your account</h1>
      <p className="mt-1 text-sm text-muted">Start organising your work in under a minute.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </div>
        )}
        <Input label="Full name" autoComplete="name" {...register('name')} error={formState.errors.name?.message} />
        <Input label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <Input label="Password" type="password" autoComplete="new-password" {...register('password')} error={formState.errors.password?.message} />
        <PasswordChecklist value={watch('password') ?? ''} />
        <Input label="Confirm password" type="password" autoComplete="new-password" {...register('confirm')} error={formState.errors.confirm?.message} />
        <div>
          <label className="flex items-start gap-2 text-sm text-muted">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" {...register('terms')} />
            <span>I agree to the terms of use and understand my data is stored securely and privately.</span>
          </label>
          {formState.errors.terms && <p className="mt-1 text-xs text-danger">{formState.errors.terms.message}</p>}
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
