'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/misc';
import { TASK_KEYS, useActiveProjects, useCategories, useInvalidate } from '@/hooks/use-lookups';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import type { Task } from '@/lib/types';
import { fromLocalInput, toLocalInput } from '@/lib/utils';

const schema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
  categoryId: z.string().optional(),
  projectId: z.string().optional(),
  dueDate: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export interface TaskDefaults {
  projectId?: string;
  dueDate?: string; // ISO
}

export function TaskFormModal({ open, onClose, task, defaults }: { open: boolean; onClose: () => void; task?: Task | null; defaults?: TaskDefaults }) {
  const { data: categories } = useCategories();
  const { data: projects } = useActiveProjects();
  const invalidate = useInvalidate();
  const editing = Boolean(task);

  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, formState, reset } = form;

  useEffect(() => {
    if (!open) return;
    reset({
      title: task?.title ?? '',
      description: task?.description ?? '',
      priority: task?.priority ?? 'MEDIUM',
      status: task?.status ?? 'TODO',
      categoryId: task?.category?.id ?? '',
      projectId: task?.project?.id ?? defaults?.projectId ?? '',
      dueDate: toLocalInput(task?.dueDate ?? defaults?.dueDate),
    });
  }, [open, task, defaults?.projectId, defaults?.dueDate, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const payload = {
      title: v.title,
      description: v.description || null,
      priority: v.priority,
      status: v.status,
      categoryId: v.categoryId || null,
      projectId: v.projectId || null,
      dueDate: fromLocalInput(v.dueDate ?? ''),
    };
    try {
      if (task) await api.patch(`/tasks/${task.id}`, payload);
      else await api.post('/tasks', payload);
      toast.success(editing ? 'Task updated' : 'Task created');
      invalidate(...TASK_KEYS);
      onClose();
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) toast.error(errorMessage(err));
    }
  });

  // Archived projects can still be shown for a task already inside one
  const projectOptions = [...(projects ?? [])];
  if (task?.project && !projectOptions.some((p) => p.id === task.project!.id)) projectOptions.push({ ...task.project } as never);

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit task' : 'New task'} size="lg">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Title" required placeholder="e.g. Write chapter 3 draft" {...register('title')} error={formState.errors.title?.message} />
        <Textarea label="Description" rows={3} placeholder="Optional details" {...register('description')} error={formState.errors.description?.message} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Priority" {...register('priority')}>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </Select>
          <Select label="Status" {...register('status')}>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select label="Category" {...register('categoryId')} error={formState.errors.categoryId?.message}>
            <option value="">No category</option>
            {categories
              ?.filter((c) => c.isActive || c.id === task?.category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.scope === 'personal' ? ' (personal)' : ''}
                </option>
              ))}
          </Select>
          <Select label="Project" {...register('projectId')} error={formState.errors.projectId?.message}>
            <option value="">No project</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Due date" type="datetime-local" {...register('dueDate')} error={formState.errors.dueDate?.message} hint="Reminders are sent before the due time (configurable in Settings)." />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {editing ? 'Save changes' : 'Create task'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
