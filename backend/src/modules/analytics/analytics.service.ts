import { prisma } from '../../lib/prisma';
import { USER_FEED_ACTIONS } from '../../common/services/activity';
import { computeStreak, dayKey, lastNDays, longestStreak, rangeStart } from '../../common/utils/dates';

export const MOOD_SCORE = { GREAT: 5, GOOD: 4, OKAY: 3, LOW: 2, STRESSED: 1 } as const;
type Mood = keyof typeof MOOD_SCORE;

/** Counts items per day for the given day keys (pure — unit tested). */
export function countByDay(days: string[], dates: Date[], tz: string): number[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const date of dates) {
    const key = dayKey(date, tz);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  return days.map((d) => counts.get(d)!);
}

/** Sums a value per day for the given day keys (pure — unit tested). */
export function sumByDay(days: string[], rows: { date: Date; value: number }[], tz: string): number[] {
  const sums = new Map(days.map((d) => [d, 0]));
  for (const row of rows) {
    const key = dayKey(row.date, tz);
    if (sums.has(key)) sums.set(key, sums.get(key)! + row.value);
  }
  return days.map((d) => sums.get(d)!);
}

/** Average mood score per day, null for days without entries (pure — unit tested). */
export function moodByDay(days: string[], rows: { loggedAt: Date; mood: Mood }[], tz: string): (number | null)[] {
  const acc = new Map<string, { total: number; n: number }>();
  for (const r of rows) {
    const key = dayKey(r.loggedAt, tz);
    const cur = acc.get(key) ?? { total: 0, n: 0 };
    acc.set(key, { total: cur.total + MOOD_SCORE[r.mood], n: cur.n + 1 });
  }
  return days.map((d) => {
    const a = acc.get(d);
    return a ? Math.round((a.total / a.n) * 10) / 10 : null;
  });
}

export async function userTimeZone(userId: string) {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { timezone: true } });
  return s?.timezone ?? 'UTC';
}

/**
 * A day counts towards the productivity streak when the user completed at least one
 * task or one focus session. Looks back one year. `tzP` may be a pending lookup so it runs in parallel.
 */
export async function productivityStreaks(userId: string, tzP: string | Promise<string>) {
  const since = rangeStart(366);
  const [tasks, sessions, tz] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: 'COMPLETED', completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.focusSession.findMany({ where: { userId, type: 'FOCUS', status: 'COMPLETED', startedAt: { gte: since } }, select: { startedAt: true } }),
    tzP,
  ]);
  const active = new Set<string>([
    ...tasks.map((t) => dayKey(t.completedAt!, tz)),
    ...sessions.map((s) => dayKey(s.startedAt, tz)),
  ]);
  return { current: computeStreak(active, dayKey(new Date(), tz)), longest: longestStreak(active), activeDays: active };
}

export async function overview(userId: string) {
  const tzP = userTimeZone(userId); // fetched alongside the other queries, not before them
  const now = new Date();
  const open = { status: { in: ['TODO', 'IN_PROGRESS'] as ('TODO' | 'IN_PROGRESS')[] } };

  const [tz, statusGroups, highPriority, overdue, upcomingTasks, completedRecent, focusRecent, moodRecent, latestMood, recentActivity, streaks, unread] =
    await Promise.all([
      tzP,
      prisma.task.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
      prisma.task.count({ where: { userId, ...open, priority: 'HIGH' } }),
      prisma.task.count({ where: { userId, ...open, dueDate: { lt: now } } }),
      prisma.task.findMany({
        where: { userId, ...open, dueDate: { gte: rangeStart(1, now), lte: new Date(now.getTime() + 7 * 864e5) } },
        orderBy: { dueDate: 'asc' },
        take: 20,
        select: { id: true, title: true, priority: true, status: true, dueDate: true, project: { select: { id: true, name: true, color: true } } },
      }),
      prisma.task.findMany({ where: { userId, status: 'COMPLETED', completedAt: { gte: rangeStart(7, now) } }, select: { completedAt: true } }),
      prisma.focusSession.findMany({
        where: { userId, type: 'FOCUS', status: 'COMPLETED', startedAt: { gte: rangeStart(7, now) } },
        select: { startedAt: true, actualSeconds: true },
      }),
      prisma.moodLog.findMany({ where: { userId, loggedAt: { gte: rangeStart(7, now) } }, select: { loggedAt: true, mood: true } }),
      prisma.moodLog.findFirst({ where: { userId }, orderBy: { loggedAt: 'desc' }, select: { mood: true, note: true, loggedAt: true } }),
      prisma.activityLog.findMany({
        where: { userId, action: { in: USER_FEED_ACTIONS } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, action: true, entityType: true, entityId: true, details: true, createdAt: true },
      }),
      productivityStreaks(userId, tzP),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
  const week = lastNDays(7, tz);
  const today = week[week.length - 1];

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Record<string, number>;
  const total = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const completed = byStatus.COMPLETED ?? 0;
  const active = (byStatus.TODO ?? 0) + (byStatus.IN_PROGRESS ?? 0);

  // Upcoming = due today (local) or within the next 7 days, overdue excluded
  const upcoming = upcomingTasks.filter((t) => t.dueDate! >= now || dayKey(t.dueDate!, tz) === today);
  const dueToday = upcoming.filter((t) => dayKey(t.dueDate!, tz) === today).length;

  const completedWeek = countByDay(week, completedRecent.map((t) => t.completedAt!), tz);
  const focusWeek = sumByDay(week, focusRecent.map((s) => ({ date: s.startedAt, value: s.actualSeconds })), tz);
  const moodWeek = moodByDay(week, moodRecent, tz);
  const moodValues = moodWeek.filter((v): v is number => v !== null);

  return {
    timezone: tz,
    tasks: {
      total,
      completed,
      active,
      todo: byStatus.TODO ?? 0,
      inProgress: byStatus.IN_PROGRESS ?? 0,
      cancelled: byStatus.CANCELLED ?? 0,
      highPriority,
      overdue,
      dueToday,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
    },
    streak: { current: streaks.current, longest: streaks.longest },
    weeklyCompletion: week.map((date, i) => ({ date, completed: completedWeek[i] })),
    focus: {
      todayMinutes: Math.round(focusWeek[focusWeek.length - 1] / 60),
      weekMinutes: Math.round(focusWeek.reduce((a, b) => a + b, 0) / 60),
      weekSessions: focusRecent.filter((s) => week.includes(dayKey(s.startedAt, tz))).length,
      daily: week.map((date, i) => ({ date, minutes: Math.round(focusWeek[i] / 60) })),
    },
    mood: {
      latest: latestMood,
      weekAverage: moodValues.length ? Math.round((moodValues.reduce((a, b) => a + b, 0) / moodValues.length) * 10) / 10 : null,
      daily: week.map((date, i) => ({ date, score: moodWeek[i] })),
    },
    upcomingTasks: upcoming.slice(0, 6),
    recentActivity,
    unreadNotifications: unread,
  };
}

export async function productivity(userId: string, days: number) {
  const tzP = userTimeZone(userId);
  const now = new Date();
  const since = rangeStart(Math.max(days, 56), now);

  const [tz, created, completed, focus, priorityGroups, statusGroups, categoryGroups, streaks] = await Promise.all([
    tzP,
    prisma.task.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.task.findMany({ where: { userId, status: 'COMPLETED', completedAt: { gte: since } }, select: { completedAt: true } }),
    prisma.focusSession.findMany({
      where: { userId, type: 'FOCUS', status: 'COMPLETED', startedAt: { gte: since } },
      select: { startedAt: true, actualSeconds: true },
    }),
    prisma.task.groupBy({ by: ['priority'], where: { userId }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } }),
    prisma.task.groupBy({ by: ['categoryId'], where: { userId }, _count: { _all: true } }),
    productivityStreaks(userId, tzP),
  ]);
  const range = lastNDays(days, tz);
  const heatmapDays = lastNDays(56, tz); // 8-week activity heatmap

  const categoryIds = categoryGroups.map((g) => g.categoryId).filter((id): id is string => Boolean(id));
  const categories = await prisma.category.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true, color: true } });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const createdSeries = countByDay(range, created.map((t) => t.createdAt), tz);
  const completedDates = completed.map((t) => t.completedAt!);
  const completedSeries = countByDay(range, completedDates, tz);
  const focusRows = focus.map((s) => ({ date: s.startedAt, value: s.actualSeconds }));
  const focusSeries = sumByDay(range, focusRows, tz);

  // Heatmap intensity = completed tasks + completed focus sessions per day
  const heatTasks = countByDay(heatmapDays, completedDates, tz);
  const heatFocus = countByDay(heatmapDays, focus.map((s) => s.startedAt), tz);

  const totalCompleted = completedSeries.reduce((a, b) => a + b, 0);
  const totalFocusMinutes = Math.round(focusSeries.reduce((a, b) => a + b, 0) / 60);
  const bestIdx = completedSeries.indexOf(Math.max(...completedSeries));

  return {
    days,
    timezone: tz,
    daily: range.map((date, i) => ({
      date,
      created: createdSeries[i],
      completed: completedSeries[i],
      focusMinutes: Math.round(focusSeries[i] / 60),
    })),
    heatmap: heatmapDays.map((date, i) => ({ date, count: heatTasks[i] + heatFocus[i], tasks: heatTasks[i], focusSessions: heatFocus[i] })),
    byPriority: ['HIGH', 'MEDIUM', 'LOW'].map((p) => ({ priority: p, count: priorityGroups.find((g) => g.priority === p)?._count._all ?? 0 })),
    byStatus: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => ({ status: s, count: statusGroups.find((g) => g.status === s)?._count._all ?? 0 })),
    byCategory: categoryGroups
      .map((g) => ({
        categoryId: g.categoryId,
        name: g.categoryId ? catMap.get(g.categoryId)?.name ?? 'Unknown' : 'Uncategorized',
        color: g.categoryId ? catMap.get(g.categoryId)?.color ?? '#94a3b8' : '#94a3b8',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count),
    summary: {
      tasksCompleted: totalCompleted,
      tasksCreated: createdSeries.reduce((a, b) => a + b, 0),
      focusMinutes: totalFocusMinutes,
      focusSessions: focusRows.filter((r) => range.includes(dayKey(r.date, tz))).length,
      avgCompletedPerDay: Math.round((totalCompleted / days) * 10) / 10,
      avgFocusMinutesPerDay: Math.round(totalFocusMinutes / days),
      bestDay: totalCompleted ? { date: range[bestIdx], completed: completedSeries[bestIdx] } : null,
      activeDays: range.filter((d) => streaks.activeDays.has(d)).length,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
  };
}

export async function moodAnalytics(userId: string, days: number) {
  const tz = await userTimeZone(userId);
  const range = lastNDays(days, tz);
  const logs = await prisma.moodLog.findMany({
    where: { userId, loggedAt: { gte: rangeStart(days) } },
    select: { loggedAt: true, mood: true },
    orderBy: { loggedAt: 'asc' },
  });
  const inRange = logs.filter((l) => range.includes(dayKey(l.loggedAt, tz)));
  const series = moodByDay(range, inRange, tz);
  const average = inRange.length ? inRange.reduce((s, l) => s + MOOD_SCORE[l.mood], 0) / inRange.length : null;

  // Trend: compare the average of the first and second half of the period
  const half = Math.floor(series.length / 2);
  const avg = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const first = avg(series.slice(0, half));
  const second = avg(series.slice(half));
  const trend = first === null || second === null ? 'insufficient_data' : second - first > 0.3 ? 'improving' : first - second > 0.3 ? 'declining' : 'stable';

  return {
    days,
    timezone: tz,
    daily: range.map((date, i) => ({ date, score: series[i] })),
    distribution: (Object.keys(MOOD_SCORE) as Mood[]).map((mood) => ({ mood, count: inRange.filter((l) => l.mood === mood).length })),
    average: average === null ? null : Math.round(average * 10) / 10,
    entries: inRange.length,
    trend,
  };
}
