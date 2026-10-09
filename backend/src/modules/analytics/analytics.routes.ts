import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { getQuery, validate } from '../../common/middleware/validate';
import { ok } from '../../common/utils/response';
import { moodAnalytics, overview, productivity } from './analytics.service';

const router = Router();

const rangeSchema = z.object({ days: z.coerce.number().int().refine((d) => [7, 14, 30, 90].includes(d), 'days must be 7, 14, 30 or 90').default(30) });

// GET /analytics/overview — dashboard KPIs, weekly chart, focus & mood summaries, upcoming tasks, recent activity
router.get('/overview', async (req: Request, res: Response) => ok(res, await overview(req.user!.id)));

// GET /analytics/productivity?days=30
router.get('/productivity', validate({ query: rangeSchema }), async (req: Request, res: Response) => {
  const { days } = getQuery(req, rangeSchema);
  return ok(res, await productivity(req.user!.id, days));
});

// GET /analytics/mood?days=30
router.get('/mood', validate({ query: rangeSchema }), async (req: Request, res: Response) => {
  const { days } = getQuery(req, rangeSchema);
  return ok(res, await moodAnalytics(req.user!.id, days));
});

export default router;
