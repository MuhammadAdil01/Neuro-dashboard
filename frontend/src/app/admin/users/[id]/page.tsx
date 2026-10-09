'use client';

import { ArrowLeft, Lock, ShieldCheck, ShieldOff, UserCheck, UserX } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { StatTile } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, Card, CardHeader, ConfirmDialog, ErrorState, Spinner } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, errorMessage } from '@/lib/api';
import type { AdminUserDetail } from '@/lib/types';
import { ACTIVITY_LABELS, formatDate, formatDateTime, minutesLabel } from '@/lib/utils';

type Action = { kind: 'status'; value: 'ACTIVE' | 'INACTIVE' } | { kind: 'role'; value: 'ADMIN' | 'USER' };

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user: me } = useAuth();
  const invalidate = useInvalidate();
  const { data: u, error, mutate } = useSWR<AdminUserDetail>(`/admin/users/${id}`);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);

  if (error) return <Card><ErrorState message={error.message} /></Card>;
  if (!u) return <Spinner />;
  const isSelf = me?.id === u.id;

  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await api.patch(`/admin/users/${id}/${pending.kind}`, pending.kind === 'status' ? { status: pending.value } : { role: pending.value });
      toast.success('User updated');
      setPending(null);
      mutate();
      invalidate('/admin/users', '/admin/stats');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmText =
    pending?.kind === 'status'
      ? pending.value === 'INACTIVE'
        ? `${u.name} will be signed out immediately and will not be able to log in until reactivated.`
        : `${u.name} will be able to log in again.`
      : pending?.value === 'ADMIN'
        ? `${u.name} will get full access to the Admin Panel.`
        : `${u.name} will lose access to the Admin Panel.`;

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Users
      </Link>

      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={u.name} url={u.avatarUrl} size={56} />
            <div>
              <h1 className="text-xl font-bold text-fg">{u.name}</h1>
              <p className="text-sm text-muted">{u.email}</p>
              <div className="mt-2 flex gap-2">
                <Badge className={u.role === 'ADMIN' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted'}>{u.role === 'ADMIN' ? 'Admin' : 'User'}</Badge>
                <Badge className={u.status === 'ACTIVE' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}>{u.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          </div>
          {isSelf ? (
            <p className="text-sm text-subtle">This is your account.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {u.status === 'ACTIVE' ? (
                <Button variant="outline" onClick={() => setPending({ kind: 'status', value: 'INACTIVE' })}>
                  <UserX className="h-4 w-4" /> Deactivate
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setPending({ kind: 'status', value: 'ACTIVE' })}>
                  <UserCheck className="h-4 w-4" /> Activate
                </Button>
              )}
              {u.role === 'USER' ? (
                <Button variant="outline" onClick={() => setPending({ kind: 'role', value: 'ADMIN' })}>
                  <ShieldCheck className="h-4 w-4" /> Make admin
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setPending({ kind: 'role', value: 'USER' })}>
                  <ShieldOff className="h-4 w-4" /> Remove admin
                </Button>
              )}
            </div>
          )}
        </div>
        <dl className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Joined</dt>
            <dd className="text-fg">{formatDate(u.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Last login</dt>
            <dd className="text-fg">{formatDateTime(u.lastLoginAt)}</dd>
          </div>
          <div>
            <dt className="text-muted">Last updated</dt>
            <dd className="text-fg">{formatDateTime(u.updatedAt)}</dd>
          </div>
        </dl>
      </Card>

      <div className="mb-2 flex items-center gap-2 text-xs text-subtle">
        <Lock className="h-3.5 w-3.5" aria-hidden /> Privacy policy: admins see aggregate counts only, never the contents of a user’s tasks, notes or mood entries.
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Tasks" value={u.stats.tasks.total} sub={`${u.stats.tasks.completed} completed`} />
        <StatTile label="Projects" value={u.stats.projects} />
        <StatTile label="Focus" value={minutesLabel(u.stats.focusMinutes)} sub={`${u.stats.focusSessions} sessions`} />
        <StatTile label="Notes" value={u.stats.notes} />
        <StatTile label="Mood entries" value={u.stats.moodLogs} />
      </div>

      <Card>
        <CardHeader title="Recent sign-in activity" />
        {u.securityEvents.length ? (
          <ul className="mt-3 divide-y divide-border">
            {u.securityEvents.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className={e.action === 'auth.login_failed' ? 'font-medium text-danger' : 'text-fg'}>{ACTIVITY_LABELS[e.action] ?? e.action}</span>
                <span className="text-xs text-subtle">
                  {e.ipAddress ?? '—'} · {formatDateTime(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-5 text-sm text-subtle">No sign-in events recorded.</p>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={apply}
        loading={busy}
        danger={pending?.kind === 'status' && pending.value === 'INACTIVE'}
        confirmLabel="Confirm"
        title="Are you sure?"
        message={confirmText}
      />
    </>
  );
}
