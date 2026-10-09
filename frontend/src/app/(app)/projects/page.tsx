'use client';

import { AlertCircle, CalendarDays, FolderKanban, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, ProgressBar, SegmentedControl, Skeleton } from '@/components/ui/misc';
import { ProjectFormModal } from '@/features/projects/project-form-modal';
import type { Project } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ProjectsPage() {
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [open, setOpen] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<Project[]>(`/projects?status=${status}`);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Group related tasks and track progress."
        actions={
          <>
            <SegmentedControl
              ariaLabel="Project status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'ARCHIVED', label: 'Archived' },
              ]}
            />
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={status === 'ACTIVE' ? 'No projects yet' : 'No archived projects'}
            description={status === 'ACTIVE' ? 'Projects group related tasks so you can see progress at a glance.' : 'Archive a project from its page when you finish it.'}
            action={
              status === 'ACTIVE' && (
                <Button onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" /> Create project
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="group">
              <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-3 w-3 shrink-0 rounded" style={{ background: p.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold text-fg group-hover:text-primary">{p.name}</h2>
                    <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{p.description || 'No description'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-muted">
                      {p.completedCount}/{p.taskCount} tasks
                    </span>
                    <span className="font-semibold text-fg">{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} color={p.color} label={`${p.name} progress`} />
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
                  {p.dueDate && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3.5 w-3.5" /> {formatDate(p.dueDate)}
                    </span>
                  )}
                  {p.overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 font-medium text-danger">
                      <AlertCircle className="h-3.5 w-3.5" /> {p.overdueCount} overdue
                    </span>
                  )}
                  {p.inProgressCount > 0 && <span>{p.inProgressCount} in progress</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      <ProjectFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
