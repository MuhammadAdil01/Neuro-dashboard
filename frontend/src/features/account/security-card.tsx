'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { PasswordChecklist } from '@/components/auth/password-checklist';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Card, CardHeader, ConfirmDialog } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors, strongPassword } from '@/lib/forms';

const schema = z
  .object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: strongPassword, confirm: z.string() })
  .refine((d) => d.newPassword === d.confirm, { message: 'Passwords do not match', path: ['confirm'] });
type Values = z.infer<typeof schema>;

/** Change password + sign out of all devices. Shared by user Settings and admin Profile. */
export function SecurityCard() {
  const { logout } = useAuth();
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newPassword: '' } });
  const { register, handleSubmit, formState, reset, watch } = form;

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      toast.success('Password updated. Other devices have been signed out.');
      reset({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) toast.error(errorMessage(err));
    }
  });

  const logoutAll = async () => {
    setBusy(true);
    try {
      await api.post('/auth/logout-all');
      toast.success('Signed out of all devices');
      await logout();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Security" description="Change your password and manage sessions." />
      <form onSubmit={onSubmit} className="space-y-4 p-5" noValidate>
        <Input label="Current password" type="password" autoComplete="current-password" {...register('currentPassword')} error={formState.errors.currentPassword?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="New password" type="password" autoComplete="new-password" {...register('newPassword')} error={formState.errors.newPassword?.message} />
          <Input label="Confirm new password" type="password" autoComplete="new-password" {...register('confirm')} error={formState.errors.confirm?.message} />
        </div>
        <PasswordChecklist value={watch('newPassword') ?? ''} />
        <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={() => setConfirmAll(true)}>
            Sign out of all devices
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        onConfirm={logoutAll}
        loading={busy}
        danger={false}
        confirmLabel="Sign out everywhere"
        title="Sign out of all devices?"
        message="Every active session, including this one, will be signed out."
      />
    </Card>
  );
}
