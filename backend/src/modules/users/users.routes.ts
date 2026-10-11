import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { endSession, startSession } from '../../lib/session';
import { ApiError } from '../../common/errors';
import { forgetSessionUser } from '../../common/middleware/auth';
import { getBody, validate } from '../../common/middleware/validate';
import { Actions, logActivity } from '../../common/services/activity';
import { ok } from '../../common/utils/response';
import { nameSchema, optionalText, passwordSchema } from '../../common/validation';
import { serializeSettings, serializeUser } from './user.serializer';

const router = Router();

const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    bio: optionalText(500),
    avatarUrl: z.union([z.string().trim().url().max(500), z.literal(''), z.null()]).optional().transform((v) => (v === '' ? null : v)),
  })
  .strict();

const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, 'Current password is required'), newPassword: passwordSchema })
  .refine((d) => d.currentPassword !== d.newPassword, { message: 'New password must be different', path: ['newPassword'] });

const timezoneSchema = z.string().max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');

const settingsSchema = z
  .object({
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    timezone: timezoneSchema,
    dateFormat: z.enum(['MMM d, yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']),
    timeFormat24h: z.boolean(),
    weekStartsOn: z.number().int().min(0).max(1),
    emailNotifications: z.boolean(),
    taskReminders: z.boolean(),
    reminderLeadMinutes: z.number().int().min(5).max(7 * 24 * 60),
    focusMinutes: z.number().int().min(1).max(120),
    shortBreakMinutes: z.number().int().min(1).max(60),
    longBreakMinutes: z.number().int().min(1).max(120),
  })
  .partial()
  .strict();

const deleteAccountSchema = z.object({ password: z.string().min(1, 'Password is required') });

const loadMe = (id: string) =>
  prisma.user.findUniqueOrThrow({ where: { id }, include: { role: true, settings: true } });

// GET /users/me
router.get('/me', async (req: Request, res: Response) => {
  return ok(res, serializeUser(await loadMe(req.user!.id)));
});

// PATCH /users/me
router.patch('/me', validate({ body: updateProfileSchema }), async (req: Request, res: Response) => {
  const data = getBody(req, updateProfileSchema);
  const user = await prisma.user.update({ where: { id: req.user!.id }, data, include: { role: true, settings: true } });
  forgetSessionUser(user.id);
  await logActivity({ userId: user.id, action: Actions.USER_PROFILE_UPDATED, details: { fields: Object.keys(data) }, req });
  return ok(res, serializeUser(user));
});

// PATCH /users/me/password
router.patch('/me/password', validate({ body: changePasswordSchema }), async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = getBody(req, changePasswordSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { role: true } });
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw ApiError.validation([{ field: 'currentPassword', message: 'Current password is incorrect' }], 'Current password is incorrect');
  }

  // Revoke other sessions, then re-issue a cookie for this browser so the user stays signed in here
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    include: { role: true },
  });
  forgetSessionUser(user.id);
  startSession(res, updated);

  await logActivity({ userId: user.id, action: Actions.USER_PASSWORD_CHANGED, req });
  return ok(res, { message: 'Password updated. Other sessions have been signed out.' });
});

// GET /users/me/settings
router.get('/me/settings', async (req: Request, res: Response) => {
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id },
    update: {},
  });
  return ok(res, serializeSettings(settings));
});

// PATCH /users/me/settings
router.patch('/me/settings', validate({ body: settingsSchema }), async (req: Request, res: Response) => {
  const data = getBody(req, settingsSchema);
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.user!.id },
    create: { userId: req.user!.id, ...data },
    update: data,
  });
  return ok(res, serializeSettings(settings));
});

// DELETE /users/me — permanent account deletion (requires password confirmation)
router.delete('/me', validate({ body: deleteAccountSchema }), async (req: Request, res: Response) => {
  const { password } = getBody(req, deleteAccountSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, include: { role: true } });
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw ApiError.validation([{ field: 'password', message: 'Password is incorrect' }], 'Password is incorrect');
  }
  if (user.role.name === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: { name: 'ADMIN' }, status: 'ACTIVE' } });
    if (admins <= 1) throw ApiError.badRequest('You are the last active admin and cannot delete this account');
  }

  // Audit entry is written first; the FK is SET NULL on delete so the entry survives
  await logActivity({ userId: user.id, action: Actions.USER_ACCOUNT_DELETED, details: { email: user.email }, req });
  await prisma.user.delete({ where: { id: user.id } }); // cascades to all owned records
  forgetSessionUser(user.id);
  endSession(res);
  return ok(res, { message: 'Your account and all associated data have been deleted.' });
});

export default router;
