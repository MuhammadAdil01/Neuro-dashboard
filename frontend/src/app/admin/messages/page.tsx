'use client';

import { Mail, Trash2 } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Pagination, SegmentedControl, Spinner } from '@/components/ui/misc';
import { api, errorMessage, pagedFetcher, qs, type Paged } from '@/lib/api';
import type { ContactMessage } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

export default function AdminMessagesPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data, error, mutate } = useSWR<Paged<ContactMessage>>(`/admin/messages${qs({ page, limit: 15, unread: filter === 'unread' ? true : undefined })}`, pagedFetcher, {
    keepPreviousData: true,
  });

  const open = async (m: ContactMessage) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.isRead) {
      await api.patch(`/admin/messages/${m.id}/read`).catch(() => {});
      mutate();
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/admin/messages/${id}`);
      toast.success('Message deleted');
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Messages"
        description={data?.meta.unreadCount ? `${data.meta.unreadCount} unread contact form submissions` : 'Contact form submissions from the public website'}
        actions={
          <SegmentedControl
            ariaLabel="Filter messages"
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
        }
      />
      <Card>
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : !data ? (
          <Spinner />
        ) : !data.data.length ? (
          <EmptyState icon={Mail} title="No messages" />
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((m) => (
              <li key={m.id}>
                <button onClick={() => open(m)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2/50" aria-expanded={openId === m.id}>
                  <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', m.isRead ? 'bg-transparent' : 'bg-primary')} aria-label={m.isRead ? undefined : 'unread'} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', m.isRead ? 'text-fg' : 'font-semibold text-fg')}>{m.subject}</span>
                    <span className="block truncate text-xs text-muted">
                      {m.name} · {m.email}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-subtle">{formatDateTime(m.createdAt)}</span>
                </button>
                {openId === m.id && (
                  <div className="border-t border-border bg-surface-2/40 px-9 py-4">
                    <p className="whitespace-pre-line text-sm text-fg">{m.message}</p>
                    <div className="mt-4 flex gap-2">
                      <a href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: ${m.subject}`)}`} className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-fg">
                        Reply by email
                      </a>
                      <Button variant="ghost" size="sm" onClick={() => remove(m.id)}>
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />}
      </Card>
    </>
  );
}
