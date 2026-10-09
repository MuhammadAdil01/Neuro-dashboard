import type { Prisma, Project } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { assertOwner } from '../../common/ownership';
import { Actions, logActivity } from '../../common/services/activity';
import { created, noContent, ok } from '../../common/utils/response';
import { booleanQuery, cleanText, colorSchema, optionalDate, optionalText } from '../../common/validation';

const router = Router();

const createSchema = z.object({
  name: cleanText(100).pipe(z.string().min(1, 'Name is required')),
  description: optionalText(1000),
  color: colorSchema.optional(),
  dueDate: optionalDate,
});
const updateSchema = createSchema.partial().extend({ status: z.enum(['ACTIVE', 'ARCHIVED']).optional() }).strict();
const listSchema = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).default('ACTIVE'),
  search: z.string().trim().max(100).optional(),
});
const deleteSchema = z.object({ deleteTasks: booleanQuery });

type Stats = { total: number; completed: number; inProgress: number; overdue: number };

/** Task counts per project, computed with grouped queries (no N+1). */
async function projectStats(projectIds: string[]): Promise<Map<string, Stats>> {
  const stats = new Map<string, Stats>(projectIds.map((id) => [id, { total: 0, completed: 0, inProgress: 0, overdue: 0 }]));
  if (!projectIds.length) return stats;

  const [byStatus, overdue] = await Promise.all([
    prisma.task.groupBy({ by: ['projectId', 'status'], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
    prisma.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: projectIds }, status: { in: ['TODO', 'IN_PROGRESS'] }, dueDate: { lt: new Date() } },
      _count: { _all: true },
    }),
  ]);
  for (const row of byStatus) {
    const s = stats.get(row.projectId!)!;
    s.total += row._count._all;
    if (row.status === 'COMPLETED') s.completed += row._count._all;
    if (row.status === 'IN_PROGRESS') s.inProgress += row._count._all;
  }
  for (const row of overdue) stats.get(row.projectId!)!.overdue = row._count._all;
  return stats;
}

function serialize(p: Project, s: Stats = { total: 0, completed: 0, inProgress: 0, overdue: 0 }) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    color: p.color,
    status: p.status,
    dueDate: p.dueDate,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    taskCount: s.total,
    completedCount: s.completed,
    inProgressCount: s.inProgress,
    overdueCount: s.overdue,
    progress: s.total ? Math.round((s.completed / s.total) * 100) : 0,
  };
}

// GET /projects
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const { status, search } = getQuery(req, listSchema);
  const where: Prisma.ProjectWhereInput = {
    userId: req.user!.id,
    ...(status !== 'ALL' ? { status } : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
  };
  const projects = await prisma.project.findMany({ where, orderBy: { createdAt: 'desc' } });
  const stats = await projectStats(projects.map((p) => p.id));
  return ok(res, projects.map((p) => serialize(p, stats.get(p.id))));
});

// POST /projects
router.post('/', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const project = await prisma.project.create({ data: { ...getBody(req, createSchema), userId: req.user!.id } });
  await logActivity({ userId: req.user!.id, action: Actions.PROJECT_CREATED, entityType: 'project', entityId: project.id, details: { name: project.name }, req });
  return created(res, serialize(project));
});

// GET /projects/:id
router.get('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const project = assertOwner(await prisma.project.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Project');
  const stats = await projectStats([project.id]);
  return ok(res, serialize(project, stats.get(project.id)));
});

// PATCH /projects/:id
router.patch('/:id', validate({ params: idParam, body: updateSchema }), async (req: Request, res: Response) => {
  const existing = assertOwner(await prisma.project.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Project');
  const project = await prisma.project.update({ where: { id: existing.id }, data: getBody(req, updateSchema) });
  await logActivity({ userId: req.user!.id, action: Actions.PROJECT_UPDATED, entityType: 'project', entityId: project.id, req });
  const stats = await projectStats([project.id]);
  return ok(res, serialize(project, stats.get(project.id)));
});

// DELETE /projects/:id?deleteTasks=true — by default tasks are kept and simply ungrouped
router.delete('/:id', validate({ params: idParam, query: deleteSchema }), async (req: Request, res: Response) => {
  const project = assertOwner(await prisma.project.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Project');
  const { deleteTasks } = getQuery(req, deleteSchema);
  await prisma.$transaction([
    ...(deleteTasks ? [prisma.task.deleteMany({ where: { projectId: project.id, userId: req.user!.id } })] : []),
    prisma.project.delete({ where: { id: project.id } }),
  ]);
  await logActivity({ userId: req.user!.id, action: Actions.PROJECT_DELETED, entityType: 'project', entityId: project.id, details: { name: project.name, deleteTasks: Boolean(deleteTasks) }, req });
  return noContent(res);
});

export default router;
