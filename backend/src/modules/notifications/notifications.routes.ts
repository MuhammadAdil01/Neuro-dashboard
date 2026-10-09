import type { Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { assertOwner } from '../../common/ownership';
import { generateTaskReminders } from '../../common/services/notify';
import { pageArgs, pageMeta, paginationSchema } from '../../common/utils/pagination';
import { noContent, ok } from '../../common/utils/response';
import { booleanQuery } from '../../common/validation';

const router = Router();

const listSchema = z.object({
  ...paginationSchema,
  unread: booleanQuery,
  type: z.enum(['TASK_REMINDER', 'TASK_DUE', 'TASK_COMPLETED', 'FOCUS', 'SYSTEM']).optional(),
});

// GET /notifications — also generates any reminders that became due since the last background run
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const q = getQuery(req, listSchema);
  await generateTaskReminders(userId);

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(q.unread !== undefined ? { isRead: !q.unread } : {}),
    ...(q.type ? { type: q.type } : {}),
  };
  const [items, total, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q.page, q.limit) }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  return ok(res, items, { ...pageMeta(q.page, q.limit, total), unreadCount });
});

// GET /notifications/unread-count — lightweight polling endpoint for the header bell
router.get('/unread-count', async (req: Request, res: Response) => {
  await generateTaskReminders(req.user!.id);
  const unreadCount = await prisma.notification.count({ where: { userId: req.user!.id, isRead: false } });
  return ok(res, { unreadCount });
});

// PATCH /notifications/read-all
router.patch('/read-all', async (req: Request, res: Response) => {
  const result = await prisma.notification.updateMany({
    where: { userId: req.user!.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return ok(res, { updated: result.count });
});

// PATCH /notifications/:id/read
router.patch('/:id/read', validate({ params: idParam }), async (req: Request, res: Response) => {
  const n = assertOwner(await prisma.notification.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Notification');
  const updated = await prisma.notification.update({ where: { id: n.id }, data: { isRead: true, readAt: n.readAt ?? new Date() } });
  return ok(res, updated);
});

// DELETE /notifications/:id
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const n = assertOwner(await prisma.notification.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Notification');
  await prisma.notification.delete({ where: { id: n.id } });
  return noContent(res);
});

export default router;
