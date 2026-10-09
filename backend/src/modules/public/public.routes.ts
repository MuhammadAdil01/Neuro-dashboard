import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { sensitiveLimiter } from '../../common/middleware/rateLimit';
import { getBody, validate } from '../../common/middleware/validate';
import { getSystemSettings } from '../../common/services/systemSettings';
import { created, ok } from '../../common/utils/response';
import { cleanText, emailSchema, nameSchema } from '../../common/validation';

const router = Router();

const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  subject: cleanText(200).pipe(z.string().min(3, 'Subject is too short')),
  message: cleanText(5000).pipe(z.string().min(10, 'Message must be at least 10 characters')),
});

// GET /public/settings — flags the public site and auth pages need
router.get('/settings', async (_req: Request, res: Response) => {
  const s = await getSystemSettings();
  return ok(res, { allowRegistration: s.allowRegistration, maintenanceMode: s.maintenanceMode, announcement: s.announcement });
});

// GET /public/stats — aggregate platform numbers for the landing page (no personal data)
router.get('/stats', async (_req: Request, res: Response) => {
  const [users, tasksCompleted, focus] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.task.count({ where: { status: 'COMPLETED' } }),
    prisma.focusSession.aggregate({ where: { status: 'COMPLETED', type: 'FOCUS' }, _sum: { actualSeconds: true } }),
  ]);
  res.setHeader('Cache-Control', 'public, max-age=300');
  return ok(res, { users, tasksCompleted, focusHours: Math.round((focus._sum.actualSeconds ?? 0) / 3600) });
});

// POST /public/contact
router.post('/contact', sensitiveLimiter, validate({ body: contactSchema }), async (req: Request, res: Response) => {
  await prisma.contactMessage.create({ data: getBody(req, contactSchema) });
  return created(res, { message: 'Thanks for reaching out! We will get back to you soon.' });
});

export default router;
