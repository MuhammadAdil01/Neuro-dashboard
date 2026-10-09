'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { Avatar, Card, CardHeader } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import type { User } from '@/lib/types';
import { formatDate, formatDateTime } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  bio: z.string().max(500).optional(),
  avatarUrl: z.union([z.string().trim().url('Enter a valid URL (https://…)'), z.literal('')]).optional(),
});
type Values = z.infer<typeof schema>;

/** Profile card shared by the user workspace and the admin panel. */
export function ProfileForm() {
  const { user, mutate } = useAuth();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, formState, reset, watch } = form;

  useEffect(() => {
    if (user) reset({ name: user.name, bio: user.bio ?? '', avatarUrl: user.avatarUrl ?? '' });
  }, [user, reset]);

  if (!user) return null;

  const onSubmit = handleSubmit(async (v) => {
    try {
      const updated = await api.patch<User>('/users/me', { name: v.name, bio: v.bio || null, avatarUrl: v.avatarUrl || null });
      await mutate(updated, { revalidate: false });
      toast.success('Profile updated');
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) toast.error(errorMessage(err));
    }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="p-6 text-center">
        <div className="flex justify-center">
          <Avatar name={watch('name') || user.name} url={watch('avatarUrl') || null} size={88} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-fg">{user.name}</h2>
        <p className="text-sm text-muted">{user.email}</p>
        <span className="mt-3 inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{user.role === 'ADMIN' ? 'Administrator' : 'Member'}</span>
        <dl className="mt-6 space-y-2 text-left text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Member since</dt>
            <dd className="text-fg">{formatDate(user.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted">Last login</dt>
            <dd className="text-fg">{formatDateTime(user.lastLoginAt)}</dd>
          </div>
        </dl>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader title="Profile information" description="This is how you appear in NeuroTask." />
        <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
          <Input label="Full name" required {...register('name')} error={formState.errors.name?.message} />
          <Input label="Email" value={user.email} disabled hint="Email changes are not supported in this version." readOnly />
          <Input label="Avatar URL" placeholder="https://…" {...register('avatarUrl')} error={formState.errors.avatarUrl?.message} />
          <Textarea label="Bio" rows={3} maxLength={500} placeholder="A short line about you" {...register('bio')} error={formState.errors.bio?.message} />
          <div className="flex justify-end">
            <Button type="submit" loading={formState.isSubmitting} disabled={!formState.isDirty}>
              Save profile
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
