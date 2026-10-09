'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSWRConfig } from 'swr';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { api, errorMessage } from '@/lib/api';
import type { User } from '@/lib/types';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
type Values = z.infer<typeof schema>;

/** Only same-site relative paths are allowed as post-login redirects (prevents open redirects). */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const [formError, setFormError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const { user } = await api.post<{ user: User }>('/auth/login', values);
      await mutate('/users/me', user, { revalidate: false });
      const next = safeNext(params.get('next'));
      router.replace(next && (user.role === 'ADMIN' || !next.startsWith('/admin')) ? next : user.role === 'ADMIN' ? '/admin' : '/dashboard');
      router.refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    }
  });

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-fg">Welcome back</h1>
      <p className="mt-1 text-sm text-muted">Log in to continue to your dashboard.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {formError && (
          <div role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {formError}
          </div>
        )}
        <Input label="Email" type="email" autoComplete="email" {...register('email')} error={formState.errors.email?.message} />
        <div className="relative">
          <Input label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" {...register('password')} error={formState.errors.password?.message} />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-[34px] text-subtle hover:text-fg" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Log in
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        New to NeuroTask?{' '}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
