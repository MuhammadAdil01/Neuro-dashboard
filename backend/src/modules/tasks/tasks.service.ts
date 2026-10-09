import type { Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../common/errors';
import { assertOwner } from '../../common/ownership';
import { notify } from '../../common/services/notify';

export const taskInclude = {
  category: { select: { id: true, name: true, color: true } },
  project: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function serializeTask(t: TaskWithRelations, now = new Date()) {
  const open = t.status === 'TODO' || t.status === 'IN_PROGRESS';
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    completedAt: t.completedAt,
    isOverdue: Boolean(open && t.dueDate && t.dueDate < now),
    category: t.category,
    project: t.project,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

/** A task may only use active global categories or the user's own categories. */
export async function assertCategoryUsable(categoryId: string | null | undefined, userId: string) {
  if (!categoryId) return;
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw ApiError.badRequest('Category does not exist');
  if (category.userId !== null && category.userId !== userId) throw ApiError.forbidden('You do not have access to this category');
  if (category.userId === null && !category.isActive) throw ApiError.badRequest('This category is no longer active');
}

export async function assertProjectOwned(projectId: string | null | undefined, userId: string) {
  if (!projectId) return;
  assertOwner(await prisma.project.findUnique({ where: { id: projectId } }), userId, 'Project');
}

/** Derives completedAt from status transitions. */
export function completionPatch(prev: TaskStatus | null, next: TaskStatus | undefined) {
  if (!next || next === prev) return {};
  if (next === 'COMPLETED') return { completedAt: new Date() };
  if (prev === 'COMPLETED') return { completedAt: null };
  return {};
}

/** Sends a one-off notification when the last open task of a project is completed. */
export async function notifyIfProjectCompleted(projectId: string | null, userId: string) {
  if (!projectId) return;
  const [open, total, project] = await Promise.all([
    prisma.task.count({ where: { projectId, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
    prisma.task.count({ where: { projectId } }),
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
  ]);
  if (project && total > 0 && open === 0) {
    await notify({
      userId,
      type: 'TASK_COMPLETED',
      title: 'Project completed',
      message: `All tasks in "${project.name}" are done. Great work!`,
      entityType: 'project',
      entityId: projectId,
    });
  }
}
