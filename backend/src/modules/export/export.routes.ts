import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { getQuery, validate } from '../../common/middleware/validate';
import { Actions, logActivity } from '../../common/services/activity';

const router = Router();

const exportSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  type: z.enum(['tasks', 'projects', 'focus', 'moods', 'notes']).default('tasks'),
});

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : String(v);
    // Neutralise spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\r\n');
}

/** Everything is filtered by the authenticated user's id — exports never include other users' data. */
async function collect(userId: string) {
  const [profile, settings, projects, categories, tasks, focus, moods, notes] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true, bio: true, createdAt: true } }),
    prisma.userSettings.findUnique({ where: { userId }, omit: { id: true, userId: true } }),
    prisma.project.findMany({ where: { userId }, omit: { userId: true }, orderBy: { createdAt: 'asc' } }),
    prisma.category.findMany({ where: { userId }, omit: { userId: true } }),
    prisma.task.findMany({
      where: { userId },
      omit: { userId: true, reminderSentAt: true, overdueSentAt: true },
      include: { project: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.focusSession.findMany({ where: { userId }, omit: { userId: true }, include: { task: { select: { title: true } } }, orderBy: { startedAt: 'asc' } }),
    prisma.moodLog.findMany({ where: { userId }, omit: { userId: true }, orderBy: { loggedAt: 'asc' } }),
    prisma.note.findMany({ where: { userId }, omit: { userId: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  return { profile, settings, projects, categories, tasks, focus, moods, notes };
}

// GET /export?format=json | GET /export?format=csv&type=tasks
router.get('/', validate({ query: exportSchema }), async (req: Request, res: Response) => {
  const { format, type } = getQuery(req, exportSchema);
  const userId = req.user!.id;
  const data = await collect(userId);
  const stamp = new Date().toISOString().slice(0, 10);
  await logActivity({ userId, action: Actions.USER_DATA_EXPORTED, details: { format, ...(format === 'csv' ? { type } : {}) }, req });

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="neurotask-export-${stamp}.json"`);
    return res.json({ exportedAt: new Date().toISOString(), ...data });
  }

  const rows: Record<string, unknown>[] = {
    tasks: () =>
      data.tasks.map((t) => ({
        title: t.title, description: t.description, status: t.status, priority: t.priority,
        project: t.project?.name, category: t.category?.name, dueDate: t.dueDate, completedAt: t.completedAt, createdAt: t.createdAt,
      })),
    projects: () => data.projects.map((p) => ({ name: p.name, description: p.description, status: p.status, dueDate: p.dueDate, createdAt: p.createdAt })),
    focus: () =>
      data.focus.map((f) => ({
        type: f.type, status: f.status, plannedMinutes: f.plannedMinutes, actualMinutes: Math.round(f.actualSeconds / 60),
        task: f.task?.title, startedAt: f.startedAt, endedAt: f.endedAt,
      })),
    moods: () => data.moods.map((m) => ({ mood: m.mood, note: m.note, loggedAt: m.loggedAt })),
    notes: () => data.notes.map((n) => ({ title: n.title, body: n.body, pinned: n.isPinned, createdAt: n.createdAt, updatedAt: n.updatedAt })),
  }[type]();

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="neurotask-${type}-${stamp}.csv"`);
  return res.send('﻿' + toCsv(rows)); // BOM so Excel detects UTF-8
});

export default router;
