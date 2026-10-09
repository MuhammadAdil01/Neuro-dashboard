'use client';

import { CheckSquare, Plus, Search } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/form';
import { Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '@/components/ui/misc';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { TaskRow } from '@/features/tasks/task-row';
import { useActiveProjects, useCategories, useDebounced } from '@/hooks/use-lookups';
import { pagedFetcher, qs, type Paged } from '@/lib/api';
import type { Task } from '@/lib/types';
import { cn } from '@/lib/utils';

const VIEWS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'today', label: 'Due today' },
  { value: 'upcoming', label: 'Next 7 days' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'high', label: 'High priority' },
  { value: 'completed', label: 'Completed' },
] as const;
type View = (typeof VIEWS)[number]['value'];

const SORTS = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'dueDate:asc', label: 'Due date (soonest)' },
  { value: 'dueDate:desc', label: 'Due date (latest)' },
  { value: 'priority:asc', label: 'Priority (high → low)' },
  { value: 'title:asc', label: 'Title (A → Z)' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
];

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { dueFrom: start.toISOString(), dueTo: end.toISOString() };
}

function TasksPageInner() {
  const params = useSearchParams();
  const [view, setView] = useState<View>((params.get('view') as View) || 'all');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const debounced = useDebounced(search);

  const { data: categories } = useCategories();
  const { data: projects } = useActiveProjects();

  useEffect(() => setPage(1), [view, debounced, priority, categoryId, projectId, sort]);

  const key = useMemo(() => {
    const [sortBy, sortOrder] = sort.split(':');
    // "Due today" uses the browser's local day so it matches what the user sees
    const range = view === 'today' ? todayRange() : {};
    return `/tasks${qs({
      page,
      limit: 15,
      view: view === 'today' ? 'active' : view,
      search: debounced,
      priority,
      categoryId,
      projectId,
      sortBy,
      sortOrder,
      ...range,
    })}`;
  }, [page, view, debounced, priority, categoryId, projectId, sort]);

  const { data, error, isLoading, mutate } = useSWR<Paged<Task>>(key, pagedFetcher, { keepPreviousData: true });
  const filtersActive = Boolean(debounced || priority || categoryId || projectId);

  return (
    <>
      <PageHeader
        title="Tasks"
        description="Create, organise and complete your work."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Task views" className="inline-flex gap-1 rounded-xl border border-border bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              role="tab"
              aria-selected={view === v.value}
              onClick={() => setView(v.value)}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                view === v.value ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              aria-label="Search tasks"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <FilterSelect value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
              <option value="">All priorities</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </FilterSelect>
            <FilterSelect value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Filter by category">
              <option value="">All categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Filter by project">
              <option value="">All projects</option>
              <option value="none">No project</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort tasks">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : data && data.data.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title={filtersActive || view !== 'all' ? 'No tasks match these filters' : 'No tasks yet'}
            description={filtersActive || view !== 'all' ? 'Try a different view or clear your filters.' : 'Create your first task to start tracking your work.'}
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setPriority('');
                    setCategoryId('');
                    setProjectId('');
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> New task
                </Button>
              )
            }
          />
        ) : (
          <ul className="divide-y divide-border" aria-busy={isLoading}>
            {data?.data.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} />)}
          </ul>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />}
      </Card>

      <TaskFormModal open={creating || Boolean(editing)} task={editing} onClose={() => {
          setCreating(false);
          setEditing(null);
        }} />
    </>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksPageInner />
    </Suspense>
  );
}
