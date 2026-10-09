import { addDaysKey, computeStreak, dayKey, lastNDays, longestStreak } from '../../src/common/utils/dates';
import { countByDay, moodByDay, sumByDay } from '../../src/modules/analytics/analytics.service';

describe('date utilities', () => {
  it('formats day keys in the requested time zone', () => {
    const d = new Date('2026-03-10T23:30:00Z');
    expect(dayKey(d, 'UTC')).toBe('2026-03-10');
    expect(dayKey(d, 'Asia/Karachi')).toBe('2026-03-11'); // UTC+5
    expect(dayKey(d, 'Not/AZone')).toBe('2026-03-10'); // falls back to UTC
  });

  it('shifts day keys across month and year boundaries', () => {
    expect(addDaysKey('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDaysKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('lists the last N days ending today', () => {
    const days = lastNDays(3, 'UTC', new Date('2026-05-02T12:00:00Z'));
    expect(days).toEqual(['2026-04-30', '2026-05-01', '2026-05-02']);
  });
});

describe('streaks', () => {
  const set = (...d: string[]) => new Set(d);

  it('counts consecutive days ending today', () => {
    expect(computeStreak(set('2026-05-01', '2026-05-02', '2026-05-03'), '2026-05-03')).toBe(3);
  });

  it('keeps the streak alive when today has no activity yet', () => {
    expect(computeStreak(set('2026-05-01', '2026-05-02'), '2026-05-03')).toBe(2);
  });

  it('resets after a missed day', () => {
    expect(computeStreak(set('2026-05-01'), '2026-05-03')).toBe(0);
    expect(computeStreak(set(), '2026-05-03')).toBe(0);
  });

  it('finds the longest run', () => {
    expect(longestStreak(set('2026-05-01', '2026-05-02', '2026-05-05', '2026-05-06', '2026-05-07'))).toBe(3);
    expect(longestStreak(set())).toBe(0);
  });
});

describe('analytics aggregation', () => {
  const days = ['2026-05-01', '2026-05-02', '2026-05-03'];

  it('counts items per day and ignores out-of-range dates', () => {
    const dates = [new Date('2026-05-01T10:00:00Z'), new Date('2026-05-01T11:00:00Z'), new Date('2026-05-03T08:00:00Z'), new Date('2026-06-01T00:00:00Z')];
    expect(countByDay(days, dates, 'UTC')).toEqual([2, 0, 1]);
  });

  it('sums values per day', () => {
    const rows = [
      { date: new Date('2026-05-02T10:00:00Z'), value: 1500 },
      { date: new Date('2026-05-02T12:00:00Z'), value: 300 },
    ];
    expect(sumByDay(days, rows, 'UTC')).toEqual([0, 1800, 0]);
  });

  it('averages mood per day with nulls for empty days', () => {
    const rows = [
      { loggedAt: new Date('2026-05-01T10:00:00Z'), mood: 'GREAT' as const },
      { loggedAt: new Date('2026-05-01T20:00:00Z'), mood: 'OKAY' as const },
      { loggedAt: new Date('2026-05-03T20:00:00Z'), mood: 'STRESSED' as const },
    ];
    expect(moodByDay(days, rows, 'UTC')).toEqual([4, null, 1]);
  });
});
