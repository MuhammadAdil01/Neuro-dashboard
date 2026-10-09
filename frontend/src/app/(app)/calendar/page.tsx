'use client';

import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader } from '@/components/ui/misc';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { TaskRow } from '@/features/tasks/task-row';
import { useAuth } from '@/hooks/use-auth';
import { pagedFetcher, qs, type Paged } from '@/lib/api';
import type { Task } from '@/lib/types';
import { cn, PRIORITY_META } from '@/lib/utils';

export default function CalendarPage() {
  const { user } = useAuth();
  const weekStartsOn = (user?.settings?.weekStartsOn ?? 1) as 0 | 1;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => new Date());
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const key = `/tasks${qs({ dueFrom: gridStart.toISOString(), dueTo: gridEnd.toISOString(), limit: 100, sortBy: 'dueDate', sortOrder: 'asc' })}`;
  const { data, error, mutate } = useSWR<Paged<Task>>(key, pagedFetcher, { keepPreviousData: true });

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of data?.data ?? []) {
      const k = format(new Date(t.dueDate!), 'yyyy-MM-dd');
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return map;
  }, [data]);

  const selectedTasks = byDay.get(format(selected, 'yyyy-MM-dd')) ?? [];
  const weekdays = Array.from({ length: 7 }, (_, i) => format(days[i], 'EEE'));
  const defaultDue = useMemo(() => {
    const d = new Date(selected);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }, [selected]);

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your tasks by due date."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add task on {format(selected, 'MMM d')}
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold text-fg">{format(month, 'MMMM yyyy')}</h2>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setMonth(subMonths(month, 1))} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMonth(startOfMonth(new Date()));
                  setSelected(new Date());
                }}
              >
                Today
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {error ? (
            <ErrorState message={error.message} onRetry={() => mutate()} />
          ) : (
            <div className="p-2 sm:p-4">
              <div className="grid grid-cols-7 pb-2 text-center text-xs font-medium text-subtle">
                {weekdays.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1" role="grid" aria-label={format(month, 'MMMM yyyy')}>
                {days.map((day) => {
                  const k = format(day, 'yyyy-MM-dd');
                  const tasks = byDay.get(k) ?? [];
                  const isSel = isSameDay(day, selected);
                  return (
                    <button
                      key={k}
                      role="gridcell"
                      aria-selected={isSel}
                      aria-label={`${format(day, 'EEEE, MMMM d')}: ${tasks.length} tasks`}
                      onClick={() => setSelected(day)}
                      className={cn(
                        'flex min-h-16 flex-col items-stretch rounded-lg border p-1 text-left transition-colors sm:min-h-24 sm:p-1.5',
                        isSel ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-2',
                        !isSameMonth(day, month) && 'opacity-40',
                      )}
                    >
                      <span
                        className={cn(
                          'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                          isToday(day) ? 'bg-primary text-primary-fg' : 'text-fg',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <span className="hidden space-y-0.5 sm:block">
                        {tasks.slice(0, 2).map((t) => (
                          <span
                            key={t.id}
                            className={cn(
                              'flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11px]',
                              t.status === 'COMPLETED' ? 'text-subtle line-through' : 'bg-surface-2 text-fg',
                            )}
                          >
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', PRIORITY_META[t.priority].dot)} aria-hidden />
                            <span className="truncate">{t.title}</span>
                          </span>
                        ))}
                        {tasks.length > 2 && <span className="block px-1 text-[11px] text-muted">+{tasks.length - 2} more</span>}
                      </span>
                      {tasks.length > 0 && (
                        <span className="flex gap-0.5 sm:hidden" aria-hidden>
                          {tasks.slice(0, 3).map((t) => (
                            <span key={t.id} className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_META[t.priority].dot)} />
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <div className="border-b border-border p-4">
            <h2 className="font-semibold text-fg">{format(selected, 'EEEE, MMMM d')}</h2>
            <p className="text-sm text-muted">
              {selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'} due
            </p>
          </div>
          {selectedTasks.length ? (
            <ul className="divide-y divide-border">
              {selectedTasks.map((t) => (
                <TaskRow key={t.id} task={t} onEdit={setEditing} />
              ))}
            </ul>
          ) : (
            <EmptyState
              title="Nothing due"
              description="Enjoy the free time, or plan something."
              action={
                <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> Add task
                </Button>
              }
            />
          )}
        </Card>
      </div>
      <TaskFormModal
        open={creating || Boolean(editing)}
        task={editing}
        defaults={{ dueDate: defaultDue }}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </>
  );
}
