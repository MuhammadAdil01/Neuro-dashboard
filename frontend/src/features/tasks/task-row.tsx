'use client';

import { CalendarClock, Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge, ConfirmDialog } from '@/components/ui/misc';
import { TASK_KEYS, useInvalidate } from '@/hooks/use-lookups';
import { api, errorMessage } from '@/lib/api';
import type { Task } from '@/lib/types';
import { cn, formatDue, PRIORITY_META, STATUS_META } from '@/lib/utils';

export function TaskRow({ task, onEdit, hideProject }: { task: Task; onEdit: (t: Task) => void; hideProject?: boolean }) {
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const done = task.status === 'COMPLETED';

  const toggle = async () => {
    setBusy(true);
    try {
      await api.patch(`/tasks/${task.id}`, { status: done ? 'TODO' : 'COMPLETED' });
      if (!done) toast.success('Task completed', { description: task.title });
      invalidate(...TASK_KEYS);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/tasks/${task.id}`);
      toast.success('Task deleted');
      setConfirm(false);
      invalidate(...TASK_KEYS);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const due = formatDue(task.dueDate);

  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2/60">
      <button
        onClick={toggle}
        disabled={busy || task.status === 'CANCELLED'}
        aria-label={done ? `Mark "${task.title}" as not completed` : `Mark "${task.title}" as completed`}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors disabled:opacity-50',
          done ? 'border-[var(--status-good)] bg-[var(--status-good)] text-white' : 'border-border hover:border-primary',
        )}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(task)}>
        <p className={cn('truncate text-sm font-medium', done ? 'text-subtle line-through' : 'text-fg')}>{task.title}</p>
        {task.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Badge className={PRIORITY_META[task.priority].className}>
            <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_META[task.priority].dot)} aria-hidden />
            {PRIORITY_META[task.priority].label}
          </Badge>
          {task.status !== 'TODO' && task.status !== 'COMPLETED' && <Badge className={STATUS_META[task.status].className}>{STATUS_META[task.status].label}</Badge>}
          {task.category && (
            <Badge className="bg-surface-2 text-muted">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: task.category.color }} aria-hidden />
              {task.category.name}
            </Badge>
          )}
          {!hideProject && task.project && (
            <Badge className="bg-surface-2 text-muted">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: task.project.color }} aria-hidden />
              {task.project.name}
            </Badge>
          )}
          {due && (
            <span className={cn('inline-flex items-center gap-1 text-xs', task.isOverdue ? 'font-medium text-danger' : 'text-muted')}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {task.isOverdue ? `Overdue · ${due}` : due}
            </span>
          )}
        </div>
      </button>
      <div className="flex shrink-0 gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button onClick={() => onEdit(task)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label={`Edit "${task.title}"`}>
          <Pencil className="h-4 w-4" />
        </button>
        <button onClick={() => setConfirm(true)} className="rounded-lg p-1.5 text-subtle hover:bg-danger-soft hover:text-danger" aria-label={`Delete "${task.title}"`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        loading={busy}
        title="Delete task?"
        message={<>“{task.title}” will be permanently deleted.</>}
      />
    </li>
  );
}
