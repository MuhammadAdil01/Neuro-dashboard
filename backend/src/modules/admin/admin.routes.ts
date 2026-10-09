import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../common/errors';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { Actions, logActivity } from '../../common/services/activity';
import { getSystemSettings, systemSettingsSchema, updateSystemSettings } from '../../common/services/systemSettings';
import { dayKey, lastNDays, rangeStart } from '../../common/utils/dates';
import { pageArgs, pageMeta, paginationSchema } from '../../common/utils/pagination';
import { created, noContent, ok } from '../../common/utils/response';
import { booleanQuery, cleanText } from '../../common/validation';
import { countByDay, sumByDay } from '../analytics/analytics.service';

/**
 * Admin Panel API. Privacy policy: admins manage accounts and see platform-wide
 * aggregates and counts, but never the content of a user's private tasks, notes,
 * mood entries or focus sessions.
 */
const router = Router();

const userListSchema = z.object({
  ...paginationSchema,
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  sortBy: z.enum(['createdAt', 'name', 'email', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
const statusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });
const roleSchema = z.object({ role: z.enum(['ADMIN', 'USER']) });
const logsSchema = z.object({
  ...paginationSchema,
  action: z.string().trim().max(80).optional(), // exact action or prefix such as "auth." / "admin."
  userId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(), // user email / name
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
const reportSchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 14, 30, 90].includes(d), 'days must be 7, 14, 30 or 90').default(30) });
const broadcastSchema = z.object({
  title: cleanText(200).pipe(z.string().min(3)),
  message: cleanText(1000).pipe(z.string().min(3)),
});
const messagesSchema = z.object({ ...paginationSchema, unread: booleanQuery });

const userSelect = {
  id: true, name: true, email: true, status: true, avatarUrl: true, lastLoginAt: true, createdAt: true, updatedAt: true,
  role: { select: { name: true } },
} satisfies Prisma.UserSelect;

const serializeUser = (u: Prisma.UserGetPayload<{ select: typeof userSelect }>) => ({ ...u, role: u.role.name });

async function activeAdminCount() {
  return prisma.user.count({ where: { role: { name: 'ADMIN' }, status: 'ACTIVE' } });
}

// GET /admin/stats — dashboard KPIs
router.get('/stats', async (_req: Request, res: Response) => {
  const now = new Date();
  const days = lastNDays(14, 'UTC', now);
  const since = rangeStart(14, now);
  const [totalUsers, activeUsers, inactiveUsers, admins, activeLast7d, newUsers30d, taskGroups, projects, notes, moodLogs, focus, signups, completions, recentEvents] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count({ where: { status: 'INACTIVE' } }),
      prisma.user.count({ where: { role: { name: 'ADMIN' } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 7 * 864e5) } } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 864e5) } } }),
      prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.project.count(),
      prisma.note.count(),
      prisma.moodLog.count(),
      prisma.focusSession.aggregate({ where: { status: 'COMPLETED', type: 'FOCUS' }, _count: true, _sum: { actualSeconds: true } }),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      prisma.task.findMany({ where: { status: 'COMPLETED', completedAt: { gte: since } }, select: { completedAt: true } }),
      prisma.activityLog.findMany({
        where: { OR: [{ action: { startsWith: 'auth.' } }, { action: { startsWith: 'admin.' } }] },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { user: { select: { name: true, email: true } } },
      }),
    ]);

  const tasksByStatus = Object.fromEntries(taskGroups.map((g) => [g.status, g._count._all]));
  const totalTasks = taskGroups.reduce((s, g) => s + g._count._all, 0);
  const signupSeries = countByDay(days, signups.map((u) => u.createdAt), 'UTC');
  const completionSeries = countByDay(days, completions.map((t) => t.completedAt!), 'UTC');

  return ok(res, {
    users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, admins, activeLast7d, newLast30d: newUsers30d },
    tasks: {
      total: totalTasks,
      completed: tasksByStatus.COMPLETED ?? 0,
      open: (tasksByStatus.TODO ?? 0) + (tasksByStatus.IN_PROGRESS ?? 0),
      completionRate: totalTasks ? Math.round(((tasksByStatus.COMPLETED ?? 0) / totalTasks) * 100) : 0,
    },
    projects,
    notes,
    moodLogs,
    focus: { sessions: focus._count, hours: Math.round(((focus._sum.actualSeconds ?? 0) / 3600) * 10) / 10 },
    trend: days.map((date, i) => ({ date, signups: signupSeries[i], completedTasks: completionSeries[i] })),
    recentEvents,
  });
});

// GET /admin/users — search, filter, sort, paginate
router.get('/users', validate({ query: userListSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, userListSchema);
  const where: Prisma.UserWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.role ? { role: { name: q.role } } : {}),
    ...(q.search
      ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] }
      : {}),
  };
  const orderBy: Prisma.UserOrderByWithRelationInput =
    q.sortBy === 'lastLoginAt' ? { lastLoginAt: { sort: q.sortOrder, nulls: 'last' } } : { [q.sortBy]: q.sortOrder };

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({ where, select: { ...userSelect, _count: { select: { tasks: true } } }, orderBy, ...pageArgs(q.page, q.limit) }),
    prisma.user.count({ where }),
  ]);
  return ok(
    res,
    users.map(({ _count, ...u }) => ({ ...serializeUser(u), taskCount: _count.tasks })),
    pageMeta(q.page, q.limit, total),
  );
});

// GET /admin/users/:id — account details and aggregate counts only (no private content)
router.get('/users/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const id = getId(req);
  const user = await prisma.user.findUnique({ where: { id }, select: userSelect });
  if (!user) throw ApiError.notFound('User');

  const [taskGroups, projects, notes, moodLogs, focus, recentLogins] = await Promise.all([
    prisma.task.groupBy({ by: ['status'], where: { userId: id }, _count: { _all: true } }),
    prisma.project.count({ where: { userId: id } }),
    prisma.note.count({ where: { userId: id } }),
    prisma.moodLog.count({ where: { userId: id } }),
    prisma.focusSession.aggregate({ where: { userId: id, status: 'COMPLETED', type: 'FOCUS' }, _count: true, _sum: { actualSeconds: true } }),
    prisma.activityLog.findMany({
      where: { userId: id, action: { startsWith: 'auth.' } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, action: true, ipAddress: true, createdAt: true },
    }),
  ]);
  const tasks = Object.fromEntries(taskGroups.map((g) => [g.status, g._count._all]));

  return ok(res, {
    ...serializeUser(user),
    stats: {
      tasks: { total: taskGroups.reduce((s, g) => s + g._count._all, 0), completed: tasks.COMPLETED ?? 0 },
      projects,
      notes,
      moodLogs,
      focusSessions: focus._count,
      focusMinutes: Math.round((focus._sum.actualSeconds ?? 0) / 60),
    },
    securityEvents: recentLogins,
  });
});

// PATCH /admin/users/:id/status — activate / deactivate
router.patch('/users/:id/status', validate({ params: idParam, body: statusSchema }), async (req: Request, res: Response) => {
  const id = getId(req);
  const { status } = getBody(req, statusSchema);
  if (id === req.user!.id) throw ApiError.badRequest('You cannot change the status of your own account');

  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) throw ApiError.notFound('User');
  if (status === 'INACTIVE' && target.role.name === 'ADMIN' && target.status === 'ACTIVE' && (await activeAdminCount()) <= 1) {
    throw ApiError.badRequest('At least one active admin is required');
  }

  const user = await prisma.user.update({
    where: { id },
    // Deactivation revokes all of the user's sessions immediately
    data: { status, ...(status === 'INACTIVE' ? { tokenVersion: { increment: 1 } } : {}) },
    select: userSelect,
  });
  await logActivity({ userId: req.user!.id, action: Actions.ADMIN_USER_STATUS, entityType: 'user', entityId: id, details: { email: user.email, from: target.status, to: status }, req });
  return ok(res, serializeUser(user));
});

// PATCH /admin/users/:id/role
router.patch('/users/:id/role', validate({ params: idParam, body: roleSchema }), async (req: Request, res: Response) => {
  const id = getId(req);
  const { role } = getBody(req, roleSchema);
  if (id === req.user!.id) throw ApiError.badRequest('You cannot change your own role');

  const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!target) throw ApiError.notFound('User');
  if (target.role.name === 'ADMIN' && role === 'USER' && target.status === 'ACTIVE' && (await activeAdminCount()) <= 1) {
    throw ApiError.badRequest('At least one active admin is required');
  }

  const roleRow = await prisma.role.findUniqueOrThrow({ where: { name: role } });
  const user = await prisma.user.update({
    where: { id },
    // Role changes take effect on the next request and old tokens (carrying the old role) are revoked
    data: { roleId: roleRow.id, tokenVersion: { increment: 1 } },
    select: userSelect,
  });
  await logActivity({ userId: req.user!.id, action: Actions.ADMIN_USER_ROLE, entityType: 'user', entityId: id, details: { email: user.email, from: target.role.name, to: role }, req });
  return ok(res, serializeUser(user));
});

// GET /admin/categories — global categories (including inactive) with platform-wide usage
router.get('/categories', async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { userId: null },
    include: { _count: { select: { tasks: true } } },
    orderBy: { name: 'asc' },
  });
  const personal = await prisma.category.count({ where: { NOT: { userId: null } } });
  return ok(
    res,
    categories.map(({ _count, userId: _u, ...c }) => ({ ...c, scope: 'global', taskCount: _count.tasks })),
    { personalCategories: personal },
  );
});

// GET /admin/activity-logs
router.get('/activity-logs', validate({ query: logsSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, logsSchema);
  const where: Prisma.ActivityLogWhereInput = {
    ...(q.action ? (q.action.endsWith('.') ? { action: { startsWith: q.action } } : { action: q.action }) : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.search
      ? { user: { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { name: { contains: q.search, mode: 'insensitive' } }] } }
      : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [logs, total] = await prisma.$transaction([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageArgs(q.page, q.limit),
    }),
    prisma.activityLog.count({ where }),
  ]);
  return ok(res, logs, pageMeta(q.page, q.limit, total));
});

// GET /admin/reports?days=30 — growth, completion and activity trends
router.get('/reports', validate({ query: reportSchema }), async (req: Request, res: Response) => {
  const { days } = getQuery(req, reportSchema);
  const range = lastNDays(days, 'UTC');
  const since = rangeStart(days);

  const [usersBefore, signups, createdTasks, completedTasks, focus, activity, moodGroups, priorityGroups, topCategories] = await Promise.all([
    prisma.user.count({ where: { createdAt: { lt: new Date(`${range[0]}T00:00:00Z`) } } }),
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.task.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.task.findMany({ where: { status: 'COMPLETED', completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.focusSession.findMany({ where: { status: 'COMPLETED', type: 'FOCUS', startedAt: { gte: since } }, select: { startedAt: true, actualSeconds: true } }),
    prisma.activityLog.findMany({ where: { createdAt: { gte: since }, userId: { not: null } }, select: { createdAt: true, userId: true } }),
    prisma.moodLog.groupBy({ by: ['mood'], where: { loggedAt: { gte: since } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['priority'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['categoryId'], where: { categoryId: { not: null } }, _count: { _all: true }, orderBy: { _count: { categoryId: 'desc' } }, take: 8 }),
  ]);

  const signupSeries = countByDay(range, signups.map((u) => u.createdAt), 'UTC');
  const createdSeries = countByDay(range, createdTasks.map((t) => t.createdAt), 'UTC');
  const completedSeries = countByDay(range, completedTasks.map((t) => t.completedAt!), 'UTC');
  const focusSeries = sumByDay(range, focus.map((f) => ({ date: f.startedAt, value: f.actualSeconds })), 'UTC');

  // Daily active users = distinct users with any logged activity that day
  const dau = new Map<string, Set<string>>(range.map((d) => [d, new Set()]));
  for (const a of activity) dau.get(dayKey(a.createdAt, 'UTC'))?.add(a.userId!);

  const cats = await prisma.category.findMany({
    where: { id: { in: topCategories.map((c) => c.categoryId!) } },
    select: { id: true, name: true, color: true, userId: true },
  });

  let cumulative = usersBefore;
  return ok(res, {
    days,
    daily: range.map((date, i) => {
      cumulative += signupSeries[i];
      return {
        date,
        signups: signupSeries[i],
        totalUsers: cumulative,
        tasksCreated: createdSeries[i],
        tasksCompleted: completedSeries[i],
        focusMinutes: Math.round(focusSeries[i] / 60),
        activeUsers: dau.get(date)!.size,
      };
    }),
    totals: {
      signups: signups.length,
      tasksCreated: createdTasks.length,
      tasksCompleted: completedTasks.length,
      focusHours: Math.round((focus.reduce((s, f) => s + f.actualSeconds, 0) / 3600) * 10) / 10,
      completionRate: createdTasks.length ? Math.round((completedTasks.length / createdTasks.length) * 100) : 0,
    },
    moodDistribution: ['GREAT', 'GOOD', 'OKAY', 'LOW', 'STRESSED'].map((m) => ({ mood: m, count: moodGroups.find((g) => g.mood === m)?._count._all ?? 0 })),
    priorityDistribution: ['HIGH', 'MEDIUM', 'LOW'].map((p) => ({ priority: p, count: priorityGroups.find((g) => g.priority === p)?._count._all ?? 0 })),
    // Only global categories are named; personal category names are private
    topCategories: topCategories.map((g) => {
      const c = cats.find((x) => x.id === g.categoryId);
      const isGlobal = c && c.userId === null;
      return { name: isGlobal ? c.name : 'Personal categories', color: isGlobal ? c.color : '#94a3b8', count: g._count._all };
    }).reduce<{ name: string; color: string; count: number }[]>((acc, row) => {
      const existing = acc.find((r) => r.name === row.name);
      if (existing) existing.count += row.count;
      else acc.push({ ...row });
      return acc;
    }, []),
  });
});

// GET /admin/settings
router.get('/settings', async (_req: Request, res: Response) => ok(res, await getSystemSettings()));

// PATCH /admin/settings
router.patch('/settings', validate({ body: systemSettingsSchema.partial().strict() }), async (req: Request, res: Response) => {
  const patch = getBody(req, systemSettingsSchema.partial());
  const settings = await updateSystemSettings(patch, req.user!.id);
  await logActivity({ userId: req.user!.id, action: Actions.ADMIN_SETTINGS, details: patch, req });
  return ok(res, settings);
});

// POST /admin/notifications/broadcast — system notification to every active user
router.post('/notifications/broadcast', validate({ body: broadcastSchema }), async (req: Request, res: Response) => {
  const { title, message } = getBody(req, broadcastSchema);
  const users = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
  const result = await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type: 'SYSTEM' as const, title, message })),
  });
  await logActivity({ userId: req.user!.id, action: Actions.ADMIN_BROADCAST, details: { title, recipients: result.count }, req });
  return created(res, { recipients: result.count });
});

// GET /admin/messages — contact form submissions
router.get('/messages', validate({ query: messagesSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, messagesSchema);
  const where: Prisma.ContactMessageWhereInput = q.unread !== undefined ? { isRead: !q.unread } : {};
  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q.page, q.limit) }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { isRead: false } }),
  ]);
  return ok(res, items, { ...pageMeta(q.page, q.limit, total), unreadCount });
});

// PATCH /admin/messages/:id/read
router.patch('/messages/:id/read', validate({ params: idParam }), async (req: Request, res: Response) => {
  const msg = await prisma.contactMessage.update({ where: { id: getId(req) }, data: { isRead: true } });
  return ok(res, msg);
});

// DELETE /admin/messages/:id
router.delete('/messages/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  await prisma.contactMessage.delete({ where: { id: getId(req) } });
  return noContent(res);
});

export default router;
