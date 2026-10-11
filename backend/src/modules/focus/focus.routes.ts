import type { FocusSession, Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../common/errors';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { assertOwner } from '../../common/ownership';
import { Actions, logActivity } from '../../common/services/activity';
import { notify } from '../../common/services/notify';
import { dayKey, lastNDays } from '../../common/utils/dates';
import { pageArgs, pageMeta, paginationSchema } from '../../common/utils/pagination';
import { created, noContent, ok } from '../../common/utils/response';

const router = Router();

const type = z.enum(['FOCUS', 'SHORT_BREAK', 'LONG_BREAK']);
const createSchema = z.object({
  type: type.default('FOCUS'),
  plannedMinutes: z.number().int().min(1).max(180),
  taskId: z.string().uuid().nullable().optional(),
});
const updateSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED']),
  actualSeconds: z.number().int().min(0).max(4 * 60 * 60),
});
const listSchema = z.object({
  ...paginationSchema,
  type: type.optional(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const include = { task: { select: { id: true, title: true } } } satisfies Prisma.FocusSessionInclude;

const serialize = (s: FocusSession & { task?: { id: string; title: string } | null }) => ({
  id: s.id,
  type: s.type,
  status: s.status,
  plannedMinutes: s.plannedMinutes,
  actualSeconds: s.actualSeconds,
  startedAt: s.startedAt,
  endedAt: s.endedAt,
  task: s.task ?? null,
});

// GET /focus-sessions
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, listSchema);
  const where: Prisma.FocusSessionWhereInput = {
    userId: req.user!.id,
    ...(q.type ? { type: q.type } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.from || q.to ? { startedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.focusSession.findMany({ where, include, orderBy: { startedAt: 'desc' }, ...pageArgs(q.page, q.limit) }),
    prisma.focusSession.count({ where }),
  ]);
  return ok(res, items.map(serialize), pageMeta(q.page, q.limit, total));
});

// GET /focus-sessions/stats — today / this week / all-time focus totals and the active session
router.get('/stats', async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const settings = await prisma.userSettings.findUnique({ where: { userId } });
  const tz = settings?.timezone ?? 'UTC';
  const week = new Set(lastNDays(7, tz));
  const today = dayKey(new Date(), tz);

  const [recent, allTime, active] = await Promise.all([
    prisma.focusSession.findMany({
      where: { userId, type: 'FOCUS', status: 'COMPLETED', startedAt: { gte: new Date(Date.now() - 8 * 864e5) } },
      select: { startedAt: true, actualSeconds: true },
    }),
    prisma.focusSession.aggregate({ where: { userId, type: 'FOCUS', status: 'COMPLETED' }, _count: true, _sum: { actualSeconds: true } }),
    prisma.focusSession.findFirst({ where: { userId, status: 'IN_PROGRESS' }, include, orderBy: { startedAt: 'desc' } }),
  ]);

  let todaySessions = 0, todaySeconds = 0, weekSessions = 0, weekSeconds = 0;
  for (const s of recent) {
    const key = dayKey(s.startedAt, tz);
    if (key === today) { todaySessions++; todaySeconds += s.actualSeconds; }
    if (week.has(key)) { weekSessions++; weekSeconds += s.actualSeconds; }
  }

  return ok(res, {
    today: { sessions: todaySessions, minutes: Math.round(todaySeconds / 60) },
    week: { sessions: weekSessions, minutes: Math.round(weekSeconds / 60) },
    allTime: { sessions: allTime._count, minutes: Math.round((allTime._sum.actualSeconds ?? 0) / 60) },
    active: active ? serialize(active) : null,
  });
});

// POST /focus-sessions — starts a session; any other running session is cancelled
router.post('/', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const data = getBody(req, createSchema);
  if (data.taskId) assertOwner(await prisma.task.findUnique({ where: { id: data.taskId } }), userId, 'Task');

  const session = await prisma.$transaction(async (tx) => {
    await tx.focusSession.updateMany({ where: { userId, status: 'IN_PROGRESS' }, data: { status: 'CANCELLED', endedAt: new Date() } });
    return tx.focusSession.create({ data: { ...data, userId }, include });
  });
  return created(res, serialize(session));
});

// PATCH /focus-sessions/:id — completes or cancels a running session
router.patch('/:id', validate({ params: idParam, body: updateSchema }), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const existing = assertOwner(await prisma.focusSession.findUnique({ where: { id: getId(req) } }), userId, 'Focus session');
  if (existing.status !== 'IN_PROGRESS') throw ApiError.conflict('This session has already ended');

  const { status, actualSeconds } = getBody(req, updateSchema);
  // The client reports focused time (pauses excluded); it can never exceed wall-clock time or the plan
  const elapsed = Math.ceil((Date.now() - existing.startedAt.getTime()) / 1000) + 5;
  const capped = Math.min(actualSeconds, elapsed, existing.plannedMinutes * 60);

  const session = await prisma.focusSession.update({
    where: { id: existing.id },
    data: { status, actualSeconds: capped, endedAt: new Date() },
    include,
  });

  if (status === 'COMPLETED' && session.type === 'FOCUS') {
    await logActivity({ userId, action: Actions.FOCUS_COMPLETED, entityType: 'focus_session', entityId: session.id, details: { minutes: Math.round(capped / 60) }, req });
    await notify({
      userId,
      type: 'FOCUS',
      title: 'Focus session complete',
      message: `You focused for ${Math.max(1, Math.round(capped / 60))} minutes${session.task ? ` on "${session.task.title}"` : ''}. Time for a break!`,
      entityType: 'focus_session',
      entityId: session.id,
    });
  }
  return ok(res, serialize(session));
});

// DELETE /focus-sessions/:id
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const session = assertOwner(await prisma.focusSession.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Focus session');
  await prisma.focusSession.delete({ where: { id: session.id } });
  return noContent(res);
});

export default router;
