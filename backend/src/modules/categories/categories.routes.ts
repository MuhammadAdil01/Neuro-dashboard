import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { ApiError } from '../../common/errors';
import { getBody, getId, getQuery, idParam, validate } from '../../common/middleware/validate';
import { Actions, logActivity } from '../../common/services/activity';
import { created, noContent, ok } from '../../common/utils/response';
import { booleanQuery, cleanText, colorSchema } from '../../common/validation';

const router = Router();

const createSchema = z.object({
  name: cleanText(50).pipe(z.string().min(1, 'Name is required')),
  color: colorSchema.optional(),
  global: z.boolean().optional().default(false),
});
const updateSchema = z
  .object({ name: cleanText(50).pipe(z.string().min(1)).optional(), color: colorSchema.optional(), isActive: z.boolean().optional() })
  .strict();
const listSchema = z.object({ includeInactive: booleanQuery });

type CategoryRow = { id: string; userId: string | null; name: string; color: string; isActive: boolean; createdAt: Date; _count?: { tasks: number } };

const serialize = (c: CategoryRow) => ({
  id: c.id,
  name: c.name,
  color: c.color,
  isActive: c.isActive,
  scope: c.userId ? ('personal' as const) : ('global' as const),
  createdAt: c.createdAt,
  ...(c._count ? { taskCount: c._count.tasks } : {}),
});

/** Global categories are editable by admins only; personal categories by their owner only. */
async function loadEditable(req: Request) {
  const category = await prisma.category.findUnique({ where: { id: getId(req) } });
  if (!category) throw ApiError.notFound('Category');
  if (category.userId === null) {
    if (req.user!.role !== 'ADMIN') throw ApiError.forbidden('Only admins can modify global categories');
  } else if (category.userId !== req.user!.id) {
    throw ApiError.forbidden('You do not have access to this category');
  }
  return category;
}

async function assertUniqueName(name: string, userId: string | null, excludeId?: string) {
  const clash = await prisma.category.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
  });
  if (clash) throw ApiError.conflict(`A category named "${name}" already exists`);
}

// GET /categories — global (active) + the user's own categories, with the user's task counts
router.get('/', validate({ query: listSchema }), async (req: Request, res: Response) => {
  const { includeInactive } = getQuery(req, listSchema);
  const userId = req.user!.id;
  const categories = await prisma.category.findMany({
    where: {
      OR: [{ userId: null, ...(includeInactive ? {} : { isActive: true }) }, { userId }],
    },
    include: { _count: { select: { tasks: { where: { userId } } } } },
    orderBy: [{ userId: { sort: 'asc', nulls: 'first' } }, { name: 'asc' }],
  });
  return ok(res, categories.map(serialize));
});

// POST /categories — personal by default; { global: true } requires ADMIN
router.post('/', validate({ body: createSchema }), async (req: Request, res: Response) => {
  const { name, color, global } = getBody(req, createSchema);
  if (global && req.user!.role !== 'ADMIN') throw ApiError.forbidden('Only admins can create global categories');
  const ownerId = global ? null : req.user!.id;
  await assertUniqueName(name, ownerId);

  const category = await prisma.category.create({ data: { name, color, userId: ownerId } });
  if (global) {
    await logActivity({ userId: req.user!.id, action: Actions.ADMIN_CATEGORY, entityType: 'category', entityId: category.id, details: { op: 'create', name }, req });
  }
  return created(res, serialize(category));
});

// PATCH /categories/:id
router.patch('/:id', validate({ params: idParam, body: updateSchema }), async (req: Request, res: Response) => {
  const category = await loadEditable(req);
  const data = getBody(req, updateSchema);
  if (data.name) await assertUniqueName(data.name, category.userId, category.id);

  const updated = await prisma.category.update({ where: { id: category.id }, data });
  if (category.userId === null) {
    await logActivity({ userId: req.user!.id, action: Actions.ADMIN_CATEGORY, entityType: 'category', entityId: category.id, details: { op: 'update', ...data }, req });
  }
  return ok(res, serialize(updated));
});

// DELETE /categories/:id — tasks keep existing with category_id set to NULL
router.delete('/:id', validate({ params: idParam }), async (req: Request, res: Response) => {
  const category = await loadEditable(req);
  await prisma.category.delete({ where: { id: category.id } });
  if (category.userId === null) {
    await logActivity({ userId: req.user!.id, action: Actions.ADMIN_CATEGORY, entityType: 'category', entityId: category.id, details: { op: 'delete', name: category.name }, req });
  }
  return noContent(res);
});

export default router;
