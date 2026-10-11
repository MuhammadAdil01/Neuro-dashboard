import type { Note, Prisma } from '@prisma/client';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { assertOwner } from '../../common/ownership';
import { Actions, logActivity } from '../../common/services/activity';
import { pageArgs, pageMeta, paginationSchema } from '../../common/utils/pagination';
import { created, noContent, ok } from '../../common/utils/response';
import { cleanText, optionalText } from '../../common/validation';

const router = Router();

const createSchema = z.object({
  title: cleanText(200).pipe(z.string().min(1, 'Title is required')),
  body: optionalText(20000),
  isPinned: z.boolean().optional(),
});
const updateSchema = createSchema.partial().strict();
const listSchema = z.object({ ...paginationSchema, search: z.string().trim().max(100).optional() });

const serialize = (n: Note) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  isPinned: n.isPinned,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

// GET /notes — pinned first, then most recently edited
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const q = getQuery(req, listSchema);
  const where: Prisma.NoteWhereInput = {
    userId: req.user!.id,
    ...(q.search
      ? { OR: [{ title: { contains: q.search, mode: 'insensitive' } }, { body: { contains: q.search, mode: 'insensitive' } }] }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.note.findMany({ where, orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }], ...pageArgs(q.page, q.limit) }),
    prisma.note.count({ where }),
  ]);
  return ok(res, items.map(serialize), pageMeta(q.page, q.limit, total));
});

// POST /notes
router.post('/', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const note = await prisma.note.create({ data: { ...getBody(req, createSchema), userId: req.user!.id } });
  await logActivity({ userId: req.user!.id, action: Actions.NOTE_CREATED, entityType: 'note', entityId: note.id, details: { title: note.title }, req });
  return created(res, serialize(note));
});

// GET /notes/:id
router.get('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const note = assertOwner(await prisma.note.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Note');
  return ok(res, serialize(note));
});

// PATCH /notes/:id
router.patch('/:id', validate({ params: idParam, body: updateSchema }), async (req: Request, res: Response) => {
  const existing = assertOwner(await prisma.note.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Note');
  const note = await prisma.note.update({ where: { id: existing.id }, data: getBody(req, updateSchema) });
  return ok(res, serialize(note));
});

// DELETE /notes/:id
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const note = assertOwner(await prisma.note.findUnique({ where: { id: getId(req) } }), req.user!.id, 'Note');
  await prisma.note.delete({ where: { id: note.id } });
  await logActivity({ userId: req.user!.id, action: Actions.NOTE_DELETED, entityType: 'note', entityId: note.id, req });
  return noContent(res);
});

export default router;
