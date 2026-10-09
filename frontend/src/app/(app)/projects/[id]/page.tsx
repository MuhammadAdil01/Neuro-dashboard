'use client';

import { Archive, ArchiveRestore, ArrowLeft, CheckSquare, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { StatTile } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Card, ConfirmDialog, EmptyState, ErrorState, Pagination, ProgressBar, SegmentedControl, Skeleton, Spinner } from '@/components/ui/misc';
import { ProjectFormModal } from '@/features/projects/project-form-modal';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { TaskRow } from '@/features/tasks/task-row';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, ApiError, errorMessage, pagedFetcher, qs, type Paged } from '@/lib/api';
import type { Project, Task } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const invalidate = useInvalidate();
  const [view, setView] = useState<'active' | 'completed' | 'all'>('active');
  const [page, setPage] = useState(1);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState(false);
  const [editProject, setEditProject] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteTasks, setDeleteTasks] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: project, error } = useSWR<Project>(`/projects/${id}`);
  const { data: tasks, isLoading } = useSWR<Paged<Task>>(`/tasks${qs({ projectId: id, view, page, limit: 20, sortBy: 'dueDate', sortOrder: 'asc' })}`, pagedFetcher, {
    keepPreviousData: true,
  });

  if (error) {
    const notAllowed = error instanceof ApiError && (error.status === 403 || error.status === 404);
    return (
      <Card>
        <ErrorState message={notAllowed ? 'This project does not exist or you do not have access to it.' : error.message} />
      </Card>
    );
  }
  if (!project) return <Spinner />;

  const toggleArchive = async () => {
    setBusy(true);
    try {
      await api.patch(`/projects/${id}`, { status: project.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' });
      toast.success(project.status === 'ACTIVE' ? 'Project archived' : 'Project restored');
      invalidate('/projects');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/projects/${id}${qs({ deleteTasks })}`);
      toast.success('Project deleted');
      invalidate('/projects', '/tasks', '/analytics');
      router.replace('/projects');
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-2 h-4 w-4 shrink-0 rounded" style={{ background: project.color }} aria-hidden />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-fg">
              {project.name} {project.status === 'ARCHIVED' && <span className="text-base font-medium text-subtle">(archived)</span>}
            </h1>
            {project.description && <p className="mt-1 max-w-2xl text-sm text-muted">{project.description}</p>}
            {project.dueDate && <p className="mt-1 text-xs text-subtle">Target: {formatDate(project.dueDate)}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setNewTask(true)}>
            <Plus className="h-4 w-4" /> Add task
          </Button>
          <Button variant="outline" onClick={() => setEditProject(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button variant="outline" onClick={toggleArchive} loading={busy}>
            {project.status === 'ACTIVE' ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
            {project.status === 'ACTIVE' ? 'Archive' : 'Restore'}
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Delete project">
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Progress" value={`${project.progress}%`} sub={<ProgressBar value={project.progress} color={project.color} label="Project progress" />} />
        <StatTile label="Tasks" value={project.taskCount} />
        <StatTile label="Completed" value={project.completedCount} tone="success" />
        <StatTile label="Overdue" value={project.overdueCount} tone={project.overdueCount ? 'danger' : 'default'} />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2 border-b border-border p-3">
          <SegmentedControl
            ariaLabel="Filter project tasks"
            value={view}
            onChange={(v) => {
              setView(v);
              setPage(1);
            }}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'completed', label: 'Completed' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
        {isLoading && !tasks ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : !tasks?.data.length ? (
          <EmptyState icon={CheckSquare} title="No tasks here" description="Add tasks to this project to track its progress." />
        ) : (
          <ul className="divide-y divide-border">
            {tasks.data.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={setEditTask} hideProject />
            ))}
          </ul>
        )}
        {tasks && <Pagination page={tasks.meta.page} totalPages={tasks.meta.totalPages} total={tasks.meta.total} onChange={setPage} />}
      </Card>

      <TaskFormModal
        open={newTask || Boolean(editTask)}
        task={editTask}
        defaults={{ projectId: id }}
        onClose={() => {
          setNewTask(false);
          setEditTask(null);
        }}
      />
      <ProjectFormModal open={editProject} project={project} onClose={() => setEditProject(false)} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        loading={busy}
        title="Delete project?"
        message={<>“{project.name}” will be permanently deleted.</>}
      >
        <label className="mt-4 flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={deleteTasks} onChange={(e) => setDeleteTasks(e.target.checked)} className="h-4 w-4 accent-[var(--danger)]" />
          Also delete its {project.taskCount} tasks (otherwise they are kept without a project)
        </label>
      </ConfirmDialog>
    </>
  );
}
