import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { env, isProd } from '../../config/env';
import { verifyToken } from '../../lib/jwt';
import { sendMail } from '../../lib/mailer';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';
import { endSession, startSession } from '../../lib/session';
import { ApiError } from '../../common/errors';
import { authenticate, forgetSessionUser } from '../../common/middleware/auth';
import { authLimiter, sensitiveLimiter } from '../../common/middleware/rateLimit';
import { getBody, validate } from '../../common/middleware/validate';
import { Actions, logActivity } from '../../common/services/activity';
import { notify } from '../../common/services/notify';
import { getSystemSettings } from '../../common/services/systemSettings';
import { created, ok } from '../../common/utils/response';
import { emailSchema, nameSchema, passwordSchema } from '../../common/validation';
import { serializeUser } from '../users/user.serializer';

const router = Router();

const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  timezone: z.string().max(64).optional(),
});
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required').max(200) });
const forgotSchema = z.object({ email: emailSchema });
const resetSchema = z.object({ token: z.string().min(20).max(200), password: passwordSchema });

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function isValidTimeZone(tz?: string) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// POST /auth/register
router.post('/register', authLimiter, validate({ body: registerSchema }), async (req: Request, res: Response) => {
  const { name, email, password, timezone } = getBody(req, registerSchema);

  const system = await getSystemSettings();
  if (!system.allowRegistration) throw ApiError.forbidden('New registrations are currently disabled');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const role = await prisma.role.findUnique({ where: { name: 'USER' } });
  if (!role) throw new ApiError(500, 'SETUP_ERROR', 'Roles are not seeded. Run the database seed.');

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      roleId: role.id,
      lastLoginAt: new Date(),
      settings: {
        create: {
          timezone: isValidTimeZone(timezone) ? timezone : 'UTC',
          focusMinutes: system.defaultFocusMinutes,
        },
      },
    },
    include: { role: true, settings: true },
  });

  const token = startSession(res, user);
  await logActivity({ userId: user.id, action: Actions.AUTH_REGISTER, entityType: 'user', entityId: user.id, req });
  await notify({
    userId: user.id,
    type: 'SYSTEM',
    title: 'Welcome to NeuroTask!',
    message: 'Your account is ready. Create your first task or start a focus session to begin.',
  });

  return created(res, { user: serializeUser(user), token });
});

// POST /auth/login
router.post('/login', authLimiter, validate({ body: loginSchema }), async (req: Request, res: Response) => {
  const { email, password } = getBody(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email }, include: { role: true, settings: true } });

  // Same message for unknown email and wrong password (prevents account enumeration)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await logActivity({ userId: user?.id, action: Actions.AUTH_LOGIN_FAILED, details: { email }, req });
    throw ApiError.unauthorized('Invalid email or password');
  }
  if (user.status !== 'ACTIVE') throw ApiError.forbidden('This account has been deactivated. Contact support.');
  if (user.role.name !== 'ADMIN' && (await getSystemSettings()).maintenanceMode) {
    throw new ApiError(503, 'MAINTENANCE', 'NeuroTask is undergoing maintenance. Please try again shortly.');
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    include: { role: true, settings: true },
  });
  const token = startSession(res, updated);
  await logActivity({ userId: user.id, action: Actions.AUTH_LOGIN, req });

  return ok(res, { user: serializeUser(updated), token });
});

// POST /auth/logout — clears this browser's session cookie
router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (token) {
    try {
      await logActivity({ userId: verifyToken(token).sub, action: Actions.AUTH_LOGOUT, req });
    } catch {
      // expired or invalid token: nothing to log, the cookie is still cleared
    }
  }
  endSession(res);
  return ok(res, { message: 'Logged out' });
});

// POST /auth/logout-all — revokes every token issued for this account
router.post('/logout-all', authenticate, async (req: Request, res: Response) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { tokenVersion: { increment: 1 } } });
  forgetSessionUser(req.user!.id);
  await logActivity({ userId: req.user!.id, action: Actions.AUTH_LOGOUT_ALL, req });
  endSession(res);
  return ok(res, { message: 'Logged out from all devices' });
});

// POST /auth/forgot-password — always returns the same response (no account enumeration)
router.post('/forgot-password', sensitiveLimiter, validate({ body: forgotSchema }), async (req: Request, res: Response) => {
  const { email } = getBody(req, forgotSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  let devResetUrl: string | undefined;

  if (user && user.status === 'ACTIVE') {
    // Invalidate older unused tokens, then issue a fresh single-use token
    await prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(rawToken),
        expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000),
      },
    });
    const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    await sendMail(
      user.email,
      'Reset your NeuroTask password',
      `Hi ${user.name},\n\nUse the link below to reset your password. It expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes and can only be used once.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    );
    await logActivity({ userId: user.id, action: Actions.AUTH_PASSWORD_RESET_REQUESTED, req });
    // Development convenience only: lets you test the flow without SMTP. Never returned in production.
    if (!isProd) devResetUrl = resetUrl;
  }

  return ok(res, {
    message: 'If an account exists for that email, a password reset link has been sent.',
    ...(devResetUrl ? { devResetUrl } : {}),
  });
});

// POST /auth/reset-password
router.post('/reset-password', authLimiter, validate({ body: resetSchema }), async (req: Request, res: Response) => {
  const { token, password } = getBody(req, resetSchema);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      // token_version bump signs out every existing session
      data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } },
    }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  forgetSessionUser(record.userId);
  await logActivity({ userId: record.userId, action: Actions.AUTH_PASSWORD_RESET, req });

  return ok(res, { message: 'Your password has been reset. You can now log in.' });
});

export default router;
