import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export const Actions = {
  AUTH_REGISTER: 'auth.register',
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGIN_FAILED: 'auth.login_failed',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_LOGOUT_ALL: 'auth.logout_all',
  AUTH_PASSWORD_RESET_REQUESTED: 'auth.password_reset_requested',
  AUTH_PASSWORD_RESET: 'auth.password_reset',
  USER_PASSWORD_CHANGED: 'user.password_changed',
  USER_PROFILE_UPDATED: 'user.profile_updated',
  USER_ACCOUNT_DELETED: 'user.account_deleted',
  USER_DATA_EXPORTED: 'user.data_exported',
  TASK_CREATED: 'task.created',
  TASK_UPDATED: 'task.updated',
  TASK_COMPLETED: 'task.completed',
  TASK_DELETED: 'task.deleted',
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  FOCUS_COMPLETED: 'focus.completed',
  MOOD_LOGGED: 'mood.logged',
  NOTE_CREATED: 'note.created',
  NOTE_DELETED: 'note.deleted',
  ADMIN_USER_STATUS: 'admin.user_status_changed',
  ADMIN_USER_ROLE: 'admin.user_role_changed',
  ADMIN_CATEGORY: 'admin.category_changed',
  ADMIN_SETTINGS: 'admin.settings_updated',
  ADMIN_BROADCAST: 'admin.broadcast_sent',
} as const;

/** Actions shown in a user's "recent activity" feed. Security/admin events are excluded. */
export const USER_FEED_ACTIONS = [
  Actions.TASK_CREATED,
  Actions.TASK_COMPLETED,
  Actions.TASK_DELETED,
  Actions.PROJECT_CREATED,
  Actions.FOCUS_COMPLETED,
  Actions.MOOD_LOGGED,
  Actions.NOTE_CREATED,
];

interface LogInput {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  req?: Request;
}

/** Writes an audit entry. Logging failures are reported but never fail the request. Never pass credentials in `details`. */
export async function logActivity({ userId, action, entityType, entityId, details, req }: LogInput) {
  try {
    await prisma.activityLog.create({
      data: {
        userId: userId ?? null,
        action,
        entityType,
        entityId,
        details,
        ipAddress: req?.ip?.slice(0, 64),
        userAgent: req?.get('user-agent')?.slice(0, 300),
      },
    });
  } catch (err) {
    console.error('Failed to write activity log:', (err as Error).message);
  }
}
