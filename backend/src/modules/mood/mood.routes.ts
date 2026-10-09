import type { MoodLog, Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { assertOwner } from '../../common/ownership';
import { Actions, logActivity } from '../../common/services/activity';
import { pageArgs, pageMeta, paginationSchema } from '../../common/utils/pagination';
import { created, noContent, ok } from '../../common/utils/response';
import { optionalText } from '../../common/validation';
import { MOOD_SCORE } from '../analytics/analytics.service';

const router = Router();

const mood = z.enum(['GREAT', 'GOOD', 'OKAY', 'LOW', 'STRESSED']);
const loggedAt = z
  .string()
  .pipe(z.coerce.date())
  .refine((d) => d.getTime() <= Date.now() + 5 * 60 * 1000, 'Mood cannot be logged in the future');
const createSchema = z.object({ mood, note: optionalText(1000), loggedAt: loggedAt.optional() });
const updateSchema = z.object({ mood: mood.optional(), note: optionalText(1000), loggedAt: loggedAt.optional() }).strict();
const listSchema = z.object({
  ...paginationSchema,
  mood: mood.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const serialize = (m: MoodLog) => ({
  id: m.id,
  mood: m.mood,
  score: MOOD_SCORE[m.mood],
  note: m.note,
  loggedAt: m.loggedAt,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

// GET /moods
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, listSchema);
  const where: Prisma.MoodLogWhereInput = {
    userId: req.user!.id,
    ...(q.mood ? { mood: q.mood } : {}),
    ...(q.from || q.to ? { loggedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.moodLog.findMany({ where, orderBy: { loggedAt: 'desc' }, ...pageArgs(q.page, q.limit) }),
    prisma.moodLog.count({ where }),
  ]);
  return ok(res, items.map(serialize), pageMeta(q.page, q.limit, total));
});

// POST /moods
router.post('/', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const entry = await prisma.moodLog.create({ data: { ...getBody(req, createSchema), userId: req.user!.id } });
  await logActivity({ userId: req.user!.id, action: Actions.MOOD_LOGGED, entityType: 'mood_log', entityId: entry.id, details: { mood: entry.mood }, req });
  return created(res, serialize(entry));
});

// PATCH /moods/:id
router.patch('/:id', validate({ params: idParam, body: updateSchema }), async (req: Request, res: Response) => {
  const existing = assertOwner(await prisma.moodLog.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Mood entry');
  const entry = await prisma.moodLog.update({ where: { id: existing.id }, data: getBody(req, updateSchema) });
  return ok(res, serialize(entry));
});

// DELETE /moods/:id
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const existing = assertOwner(await prisma.moodLog.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Mood entry');
  await prisma.moodLog.delete({ where: { id: existing.id } });
  return noContent(res);
});

export default router;
