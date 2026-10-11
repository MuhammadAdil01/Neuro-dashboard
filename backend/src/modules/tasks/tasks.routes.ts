import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../common/errors';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { assertOwner } from '../../common/ownership';
import { Actions, logActivity } from '../../common/services/activity';
import { getSystemSettings } from '../../common/services/systemSettings';
import { pageArgs, pageMeta, paginationSchema } from '../../common/utils/pagination';
import { created, noContent, ok } from '../../common/utils/response';
import { cleanText, optionalDate, optionalText } from '../../common/validation';
import {
  assertCategoryUsable,
  assertProjectOwned,
  completionPatch,
  notifyIfProjectCompleted,
  serializeTask,
  taskInclude,
} from './tasks.service';

const router = Router();

const priority = z.enum(['HIGH', 'MEDIUM', 'LOW']);
const status = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const uuidOrNull = z.union([z.string().uuid(), z.null(), z.literal('')]).optional().transform((v) => (v === '' ? null : v));
const MAX_DUE = new Date('2100-01-01T00:00:00Z');

const createSchema = z.object({
  title: cleanText(200).pipe(z.string().min(1, 'Title is required')),
  description: optionalText(5000),
  priority: priority.default('MEDIUM'),
  status: status.default('TODO'),
  dueDate: optionalDate.refine(
    // New tasks cannot be due in the past (24h grace covers time-zone differences for "today")
    (d) => !d || (d.getTime() >= Date.now() - 24 * 60 * 60 * 1000 && d < MAX_DUE),
    'Due date cannot be in the past',
  ),
  categoryId: uuidOrNull,
  projectId: uuidOrNull,
});

const updateSchema = z
  .object({
    title: cleanText(200).pipe(z.string().min(1, 'Title is required')).optional(),
    description: optionalText(5000),
    priority: priority.optional(),
    status: status.optional(),
    dueDate: optionalDate.refine((d) => !d || d < MAX_DUE, 'Due date is too far in the future'),
    categoryId: uuidOrNull,
    projectId: uuidOrNull,
  })
  .strict();

const listSchema = z.object({
  ...paginationSchema,
  search: z.string().trim().max(100).optional(),
  view: z.enum(['all', 'active', 'completed', 'high', 'overdue', 'today', 'upcoming']).default('all'),
  status: z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',') : undefined))
    .pipe(z.array(status).optional()),
  priority: priority.optional(),
  categoryId: z.string().uuid().optional(),
  projectId: z.union([z.string().uuid(), z.literal('none')]).optional(),
  dueFrom: z.coerce.date().optional(),
  dueTo: z.coerce.date().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const OPEN: Prisma.TaskWhereInput = { status: { in: ['TODO', 'IN_PROGRESS'] } };

function viewFilter(view: z.infer<typeof listSchema>['view'], now: Date): Prisma.TaskWhereInput {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  switch (view) {
    case 'active':
      return OPEN;
    case 'completed':
      return { status: 'COMPLETED' };
    case 'high':
      return { ...OPEN, priority: 'HIGH' };
    case 'overdue':
      return { ...OPEN, dueDate: { lt: now } };
    case 'today':
      return { ...OPEN, dueDate: { gte: startOfDay, lt: endOfDay } };
    case 'upcoming':
      return { ...OPEN, dueDate: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } };
    default:
      return {};
  }
}

// GET /tasks — server-side search, filters, sorting and pagination
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, listSchema);
  const now = new Date();

  const where: Prisma.TaskWhereInput = {
    userId: req.user!.id, // ownership: users only ever list their own tasks
    AND: [
      viewFilter(q.view, now),
      q.status ? { status: { in: q.status } } : {},
      q.priority ? { priority: q.priority } : {},
      q.categoryId ? { categoryId: q.categoryId } : {},
      q.projectId ? { projectId: q.projectId === 'none' ? null : q.projectId } : {},
      q.dueFrom || q.dueTo ? { dueDate: { ...(q.dueFrom ? { gte: q.dueFrom } : {}), ...(q.dueTo ? { lte: q.dueTo } : {}) } } : {},
      q.search
        ? { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { description: { contains: q.search, mode: 'insensitive' } }] }
        : {},
    ],
  };

  const orderBy: Prisma.TaskOrderByWithRelationInput[] =
    q.sortBy === 'dueDate'
      ? [{ dueDate: { sort: q.sortOrder, nulls: 'last' } }, { createdAt: 'desc' }]
      : [{ [q.sortBy]: q.sortOrder }, { createdAt: 'desc' }];

  const [items, total] = await Promise.all([
    prisma.task.findMany({ where, include: taskInclude, orderBy, ...pageArgs(q.page, q.limit) }),
    prisma.task.count({ where }),
  ]);
  return ok(res, items.map((t) => serializeTask(t, now)), pageMeta(q.page, q.limit, total));
});

// POST /tasks
router.post('/', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const data = getBody(req, createSchema);
  const userId = req.user!.id;
  const [, , { maxTasksPerUser }, taskCount] = await Promise.all([
    assertCategoryUsable(data.categoryId, userId),
    assertProjectOwned(data.projectId, userId),
    getSystemSettings(),
    prisma.task.count({ where: { userId } }),
  ]);
  if (taskCount >= maxTasksPerUser) {
    throw ApiError.badRequest(`Task limit reached (${maxTasksPerUser}). Delete old tasks to add new ones.`);
  }

  const task = await prisma.task.create({
    data: { ...data, userId, completedAt: data.status === 'COMPLETED' ? new Date() : null },
    include: taskInclude,
  });
  await logActivity({ userId, action: Actions.TASK_CREATED, entityType: 'task', entityId: task.id, details: { title: task.title }, req });
  return created(res, serializeTask(task));
});

// GET /tasks/:id
router.get('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const task = assertOwner(await prisma.task.findUnique({ where: { id: getId(req) }, include: taskInclude }), req.user!.id, 'Task');
  return ok(res, serializeTask(task));
});

// PATCH /tasks/:id
router.patch('/:id', validate({ params: idParam, body: updateSchema }), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const existing = assertOwner(await prisma.task.findUnique({ where: { id: getId(req) } }), userId, 'Task');
  const data = getBody(req, updateSchema);
  await Promise.all([assertCategoryUsable(data.categoryId, userId), assertProjectOwned(data.projectId, userId)]);

  const dueChanged = data.dueDate !== undefined && data.dueDate?.getTime() !== existing.dueDate?.getTime();
  const task = await prisma.task.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...completionPatch(existing.status, data.status),
      // A new due date re-arms the reminder and overdue notifications
      ...(dueChanged ? { reminderSentAt: null, overdueSentAt: null } : {}),
    },
    include: taskInclude,
  });

  const justCompleted = data.status === 'COMPLETED' && existing.status !== 'COMPLETED';
  await logActivity({
    userId,
    action: justCompleted ? Actions.TASK_COMPLETED : Actions.TASK_UPDATED,
    entityType: 'task',
    entityId: task.id,
    details: { title: task.title, fields: Object.keys(data) },
    req,
  });
  if (justCompleted) await notifyIfProjectCompleted(task.projectId, userId);

  return ok(res, serializeTask(task));
});

// DELETE /tasks/:id
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const task = assertOwner(await prisma.task.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Task');
  await prisma.task.delete({ where: { id: task.id } });
  await logActivity({ userId: req.user!.id, action: Actions.TASK_DELETED, entityType: 'task', entityId: task.id, details: { title: task.title }, req });
  return noContent(res);
});

export default router;
