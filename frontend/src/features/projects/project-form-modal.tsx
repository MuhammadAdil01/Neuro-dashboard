'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/form';
import { Modal } from '@/components/ui/misc';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, ApiError, errorMessage } from '@/lib/api';
import { applyServerErrors } from '@/lib/forms';
import type { Project } from '@/lib/types';
import { cn, PROJECT_COLORS } from '@/lib/utils';

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  color: z.string(),
  dueDate: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function ProjectFormModal({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project | null }) {
  const invalidate = useInvalidate();
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, formState, reset, watch, setValue } = form;

  useEffect(() => {
    if (open)
      reset({
        name: project?.name ?? '',
        description: project?.description ?? '',
        color: project?.color ?? PROJECT_COLORS[0],
        dueDate: project?.dueDate ? project.dueDate.slice(0, 10) : '',
      });
  }, [open, project, reset]);

  const onSubmit = handleSubmit(async (v) => {
    const payload = {
      name: v.name,
      description: v.description || null,
      color: v.color,
      dueDate: v.dueDate ? new Date(`${v.dueDate}T23:59:00`).toISOString() : null,
    };
    try {
      if (project) await api.patch(`/projects/${project.id}`, payload);
      else await api.post('/projects', payload);
      toast.success(project ? 'Project updated' : 'Project created');
      invalidate('/projects', '/tasks', '/analytics');
      onClose();
    } catch (err) {
      if (!(err instanceof ApiError && applyServerErrors(err, form.setError))) toast.error(errorMessage(err));
    }
  });

  const color = watch('color');

  return (
    <Modal open={open} onClose={onClose} title={project ? 'Edit project' : 'New project'}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Input label="Name" required placeholder="e.g. Final Year Project" {...register('name')} error={formState.errors.name?.message} />
        <Textarea label="Description" rows={3} {...register('description')} error={formState.errors.description?.message} />
        <Input label="Target date" type="date" {...register('dueDate')} />
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-fg">Color</legend>
          <div className="flex flex-wrap gap-2">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setValue('color', c)}
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                className={cn('h-8 w-8 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition', color === c && 'ring-2 ring-[var(--fg)]')}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {project ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
