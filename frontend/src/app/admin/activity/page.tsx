'use client';

import { ScrollText, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { FilterSelect } from '@/components/ui/form';
import { Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '@/components/ui/misc';
import { useDebounced } from '@/hooks/use-lookups';
import { pagedFetcher, qs, type Paged } from '@/lib/api';
import type { ActivityLog } from '@/lib/types';
import { ACTIVITY_LABELS, cn, formatDateTime } from '@/lib/utils';

const GROUPS = [
  { value: '', label: 'All events' },
  { value: 'auth.', label: 'Authentication' },
  { value: 'auth.login_failed', label: 'Failed logins' },
  { value: 'admin.', label: 'Admin actions' },
  { value: 'user.', label: 'Account changes' },
  { value: 'task.', label: 'Tasks' },
  { value: 'project.', label: 'Projects' },
];

function detailsText(d: Record<string, unknown> | null) {
  if (!d) return '';
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

export default function AdminActivityPage() {
  const [action, setAction] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  useEffect(() => setPage(1), [action, debounced]);

  const { data, error, isLoading, mutate } = useSWR<Paged<ActivityLog>>(`/admin/activity-logs${qs({ page, limit: 25, action, search: debounced })}`, pagedFetcher, {
    keepPreviousData: true,
  });

  return (
    <>
      <PageHeader title="Activity logs" description="Audit trail of security, administrative and user events." />
      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by user name or email…"
              aria-label="Filter by user"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
            />
          </div>
          <FilterSelect value={action} onChange={(e) => setAction(e.target.value)} aria-label="Event type">
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </FilterSelect>
        </div>
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState icon={ScrollText} title="No events found" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.data.map((l) => (
                  <tr key={l.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted tabular">{formatDateTime(l.createdAt)}</td>
                    <td className={cn('whitespace-nowrap px-4 py-2.5 font-medium', l.action === 'auth.login_failed' ? 'text-danger' : 'text-fg')}>{ACTIVITY_LABELS[l.action] ?? l.action}</td>
                    <td className="px-4 py-2.5 text-muted">{l.user?.email ?? <span className="text-subtle">deleted / unknown</span>}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-muted" title={detailsText(l.details)}>
                      {detailsText(l.details) || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-subtle">{l.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />}
      </Card>
    </>
  );
}
