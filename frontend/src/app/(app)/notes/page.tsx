'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { NotebookPen, Pin, PinOff, Plus, Search, Trash2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Pagination, Skeleton } from '@/components/ui/misc';
import { useDebounced, useInvalidate } from '@/hooks/use-lookups';
import { api, ApiError, errorMessage, pagedFetcher, qs, type Paged } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import type { Note } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().max(20000).optional(),
});
type Values = z.infer<typeof schema>;

function NoteModal({ open, note, onClose }: { open: boolean; note: Note | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, formState, reset, watch } = form;

  useEffect(() => {
    if (open) reset({ title: note?.title ?? '', body: note?.body ?? '' });
  }, [open, note, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const payload = { title: v.title, body: v.body || null };
      if (note) await api.patch(`/notes/${note.id}`, payload);
      else await api.post('/notes', payload);
      toast.success(note ? 'Note saved' : 'Note created');
      invalidate('/notes', '/analytics');
      onClose();
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) toast.error(errorMessage(err));
    }
  });

  return (
    <Modal open={open} onClose={onClose} title={note ? 'Edit note' : 'New note'} size="lg">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Title" required {...register('title')} error={formState.errors.title?.message} />
        <Textarea label="Body" rows={12} {...register('body')} error={formState.errors.body?.message} hint={`${(watch('body') ?? '').length.toLocaleString()} / 20,000 characters`} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {note ? 'Save' : 'Create note'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function NotesInner() {
  const params = useSearchParams();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [deleting, setDeleting] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const debounced = useDebounced(search);
  const invalidate = useInvalidate();

  useEffect(() => setPage(1), [debounced]);
  const { data, error, isLoading, mutate } = useSWR<Paged<Note>>(`/notes${qs({ page, limit: 12, search: debounced })}`, pagedFetcher, { keepPreviousData: true });

  const togglePin = async (n: Note) => {
    try {
      await api.patch(`/notes/${n.id}`, { isPinned: !n.isPinned });
      invalidate('/notes');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/notes/${deleting.id}`);
      toast.success('Note deleted');
      setDeleting(null);
      invalidate('/notes');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Notes"
        description="Capture ideas, meeting notes and summaries."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New note
          </Button>
        }
      />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
        />
      </div>

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : isLoading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !data?.data.length ? (
        <Card>
          <EmptyState
            icon={NotebookPen}
            title={debounced ? 'No notes match your search' : 'No notes yet'}
            description={debounced ? 'Try another keyword.' : 'Notes are private to you.'}
            action={
              !debounced && (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New note
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.data.map((n) => (
              <Card key={n.id} className={cn('group flex flex-col p-4 transition-shadow hover:shadow-md', n.isPinned && 'border-primary/40')}>
                <div className="flex items-start gap-2">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(n)}>
                    <h2 className="line-clamp-1 font-semibold text-fg">{n.title}</h2>
                  </button>
                  <button onClick={() => togglePin(n)} className={cn('rounded p-1', n.isPinned ? 'text-primary' : 'text-subtle hover:text-fg')} aria-label={n.isPinned ? 'Unpin note' : 'Pin note'} aria-pressed={n.isPinned}>
                    {n.isPinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                  </button>
                </div>
                <button className="mt-2 flex-1 text-left" onClick={() => setEditing(n)}>
                  <p className="line-clamp-5 whitespace-pre-line text-sm text-muted">{n.body || <span className="italic text-subtle">Empty note</span>}</p>
                </button>
                <div className="mt-3 flex items-center justify-between text-xs text-subtle">
                  <span>Edited {timeAgo(n.updatedAt)}</span>
                  <button onClick={() => setDeleting(n)} className="rounded p-1 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label={`Delete note "${n.title}"`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
          {data.meta.totalPages > 1 && (
          <Card className="mt-4">
            <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />
          </Card>
          )}
        </>
      )}

      <NoteModal
        open={creating || Boolean(editing)}
        note={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy} title="Delete note?" message={<>“{deleting?.title}” will be permanently deleted.</>} />
    </>
  );
}

export default function NotesPage() {
  return (
    <Suspense>
      <NotesInner />
    </Suspense>
  );
}
