'use client';

import { AlarmClock, Bell, CheckCheck, CheckCircle2, Info, Timer, Trash2, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Pagination, SegmentedControl, Skeleton } from '@/components/ui/misc';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, errorMessage, pagedFetcher, qs, type Paged } from '@/lib/api';
import type { Notification, NotificationType } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

const TYPE_META: Record<NotificationType, { icon: React.ElementType; className: string; label: string }> = {
  TASK_REMINDER: { icon: AlarmClock, className: 'bg-warning-soft text-warning', label: 'Reminder' },
  TASK_DUE: { icon: TriangleAlert, className: 'bg-danger-soft text-danger', label: 'Overdue' },
  TASK_COMPLETED: { icon: CheckCircle2, className: 'bg-success-soft text-success', label: 'Completed' },
  FOCUS: { icon: Timer, className: 'bg-primary-soft text-primary', label: 'Focus' },
  SYSTEM: { icon: Info, className: 'bg-surface-2 text-muted', label: 'System' },
};

function linkFor(n: Notification) {
  if (n.entityType === 'project' && n.entityId) return `/projects/${n.entityId}`;
  if (n.entityType === 'task') return '/tasks';
  if (n.entityType === 'focus_session') return '/focus';
  return null;
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const invalidate = useInvalidate();
  const { data, error, isLoading, mutate } = useSWR<Paged<Notification>>(
    `/notifications${qs({ page, limit: 15, unread: filter === 'unread' ? true : undefined })}`,
    pagedFetcher,
    { keepPreviousData: true },
  );
  const unread = data?.meta.unreadCount ?? 0;

  const act = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast.success(success);
      invalidate('/notifications');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `You have ${unread} unread ${unread === 1 ? 'notification' : 'notifications'}.` : 'You’re all caught up.'}
        actions={
          <>
            <SegmentedControl
              ariaLabel="Filter notifications"
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
              options={[
                { value: 'all', label: 'All' },
                { value: 'unread', label: 'Unread' },
              ]}
            />
            <Button variant="outline" disabled={!unread} onClick={() => act(() => api.patch('/notifications/read-all'), 'All notifications marked as read')}>
              <CheckCheck className="h-4 w-4" /> Mark all read
            </Button>
          </>
        }
      />
      <Card>
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState icon={Bell} title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'} description="Due-date reminders and updates will appear here." />
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((n) => {
              const meta = TYPE_META[n.type];
              const href = linkFor(n);
              return (
                <li key={n.id} className={cn('group flex items-start gap-3 px-4 py-4', !n.isRead && 'bg-primary-soft/40')}>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', meta.className)}>
                    <meta.icon className="h-4 w-4" aria-hidden />
                    <span className="sr-only">{meta.label}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-sm text-fg', !n.isRead && 'font-semibold')}>
                      {n.title}
                      {!n.isRead && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-primary align-middle" aria-label="unread" />}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">{n.message}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-subtle">
                      <span>{timeAgo(n.createdAt)}</span>
                      {href && (
                        <Link href={href} onClick={() => !n.isRead && api.patch(`/notifications/${n.id}/read`).catch(() => {})} className="font-medium text-primary hover:underline">
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    {!n.isRead && (
                      <Button variant="ghost" size="sm" onClick={() => act(() => api.patch(`/notifications/${n.id}/read`))}>
                        Mark read
                      </Button>
                    )}
                    <button onClick={() => act(() => api.delete(`/notifications/${n.id}`))} className="rounded-lg p-1.5 text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Delete notification">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />}
      </Card>
    </>
  );
}
