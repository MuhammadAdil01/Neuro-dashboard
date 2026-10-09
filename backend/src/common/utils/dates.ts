/** Returns the calendar day (YYYY-MM-DD) of `date` in the given IANA time zone. */
export function dayKey(date: Date, timeZone = 'UTC'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Shifts a YYYY-MM-DD key by n days. */
export function addDaysKey(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Inclusive list of the last `days` day keys ending today (in `timeZone`). */
export function lastNDays(days: number, timeZone = 'UTC', now = new Date()): string[] {
  const today = dayKey(now, timeZone);
  return Array.from({ length: days }, (_, i) => addDaysKey(today, i - (days - 1)));
}

/** A safe lower bound for DB queries covering the last `days` local days (adds a 1-day margin for time zones). */
export function rangeStart(days: number, now = new Date()): Date {
  return new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000);
}

/**
 * Consecutive active days ending today. If today has no activity yet the streak
 * is still alive when yesterday was active (the user has until midnight).
 */
export function computeStreak(activeDays: Set<string>, todayKey: string): number {
  let cursor = activeDays.has(todayKey) ? todayKey : addDaysKey(todayKey, -1);
  let streak = 0;
  while (activeDays.has(cursor)) {
    streak += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive days in the set. */
export function longestStreak(activeDays: Set<string>): number {
  let best = 0;
  for (const day of activeDays) {
    if (activeDays.has(addDaysKey(day, -1))) continue; // not the start of a run
    let len = 1;
    let cursor = addDaysKey(day, 1);
    while (activeDays.has(cursor)) {
      len += 1;
      cursor = addDaysKey(cursor, 1);
    }
    best = Math.max(best, len);
  }
  return best;
}
