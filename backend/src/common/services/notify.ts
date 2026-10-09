import type { NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';

interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

export async function notify(input: NotifyInput) {
  try {
    return await prisma.notification.create({ data: input });
  } catch (err) {
    console.error('Failed to create notification:', (err as Error).message);
    return null;
  }
}

/**
 * Creates due-soon reminders and overdue alerts for open tasks.
 * Each task gets at most one reminder and one overdue alert (tracked by
 * reminder_sent_at / overdue_sent_at), so the job is idempotent and safe to
 * run on an interval and on demand. Pass a userId to limit it to one user.
 */
export async function generateTaskReminders(userId?: string, now = new Date()) {
  const open = { status: { in: ['TODO', 'IN_PROGRESS'] as ('TODO' | 'IN_PROGRESS')[] } };
  const userFilter = userId ? { userId } : {};
  const enabled = { user: { status: 'ACTIVE' as const, settings: { is: { taskReminders: true } } } };
  let created = 0;

  // Due soon: due date within each user's reminder lead time (max 7 days look-ahead)
  const dueSoon = await prisma.task.findMany({
    where: {
      ...userFilter,
      ...open,
      ...enabled,
      reminderSentAt: null,
      dueDate: { gt: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, userId: true, title: true, dueDate: true, user: { select: { settings: { select: { reminderLeadMinutes: true } } } } },
    take: 500,
  });
  for (const task of dueSoon) {
    const lead = (task.user.settings?.reminderLeadMinutes ?? 60) * 60 * 1000;
    if (task.dueDate!.getTime() - now.getTime() > lead) continue;
    const claimed = await prisma.task.updateMany({ where: { id: task.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count === 0) continue; // another worker already handled it
    const minutes = Math.max(1, Math.round((task.dueDate!.getTime() - now.getTime()) / 60000));
    const when = minutes >= 120 ? `${Math.round(minutes / 60)} hours` : `${minutes} minutes`;
    await notify({
      userId: task.userId,
      type: 'TASK_REMINDER',
      title: 'Task due soon',
      message: `"${task.title}" is due in about ${when}.`,
      entityType: 'task',
      entityId: task.id,
    });
    created++;
  }

  // Overdue
  const overdue = await prisma.task.findMany({
    where: { ...userFilter, ...open, ...enabled, overdueSentAt: null, dueDate: { lte: now } },
    select: { id: true, userId: true, title: true },
    take: 500,
  });
  for (const task of overdue) {
    const claimed = await prisma.task.updateMany({ where: { id: task.id, overdueSentAt: null }, data: { overdueSentAt: now } });
    if (claimed.count === 0) continue;
    await notify({
      userId: task.userId,
      type: 'TASK_DUE',
      title: 'Task overdue',
      message: `"${task.title}" is past its due date.`,
      entityType: 'task',
      entityId: task.id,
    });
    created++;
  }

  return created;
}
