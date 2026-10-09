'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { ActivityHeatmap, BreakdownBars, DailyBarChart, DailyLineChart, StatTile } from '@/components/charts/charts';
import { buttonClass } from '@/components/ui/button';
import { Card, CardHeader, ErrorState, PageHeader, SegmentedControl, Skeleton } from '@/components/ui/misc';
import type { MoodAnalytics, Productivity } from '@/lib/types';
import { dayLabel, minutesLabel, MOOD_META, moodFromScore, PRIORITY_META, STATUS_META } from '@/lib/utils';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, error, isLoading, mutate } = useSWR<Productivity>(`/analytics/productivity?days=${days}`, { keepPreviousData: true });
  const { data: mood } = useSWR<MoodAnalytics>(`/analytics/mood?days=${days}`, { keepPreviousData: true });

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Trends calculated from your tasks, focus sessions and mood entries."
        actions={
          <>
            <SegmentedControl ariaLabel="Date range" value={days} onChange={setDays} options={RANGES} />
            <a href="/api/v1/export?format=csv&type=tasks" className={buttonClass('outline')} download>
              <Download className="h-4 w-4" /> Export CSV
            </a>
          </>
        }
      />

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : isLoading || !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Tasks completed" value={data.summary.tasksCompleted} sub={`${data.summary.avgCompletedPerDay} per day · ${data.summary.tasksCreated} created`} />
            <StatTile label="Focus time" value={minutesLabel(data.summary.focusMinutes)} sub={`${data.summary.focusSessions} sessions · ${minutesLabel(data.summary.avgFocusMinutesPerDay)}/day`} />
            <StatTile label="Active days" value={`${data.summary.activeDays}/${days}`} sub={`Streak ${data.summary.currentStreak} · best ${data.summary.longestStreak}`} />
            <StatTile
              label="Best day"
              value={data.summary.bestDay ? data.summary.bestDay.completed : '—'}
              sub={data.summary.bestDay ? `tasks on ${dayLabel(data.summary.bestDay.date)}` : 'Complete a task to set one'}
            />
          </section>

          <Card>
            <CardHeader title="Tasks created vs completed" description={`Daily counts over the last ${days} days`} />
            <div className="p-5">
              <DailyBarChart
                data={data.daily}
                series={[
                  { key: 'created', label: 'Created', color: 'var(--chart-1)' },
                  { key: 'completed', label: 'Completed', color: 'var(--chart-2)' },
                ]}
                caption={`Tasks created and completed per day, last ${days} days`}
                weekday={days === 7}
                height={280}
              />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Focus minutes" description="Completed focus time per day" />
              <div className="p-5">
                <DailyBarChart
                  data={data.daily}
                  series={[{ key: 'focusMinutes', label: 'Focus minutes', color: 'var(--chart-3)', format: (v) => minutesLabel(v) }]}
                  caption={`Focus minutes per day, last ${days} days`}
                  weekday={days === 7}
                />
              </div>
            </Card>
            <Card>
              <CardHeader
                title="Mood trend"
                description={
                  mood?.average != null ? `Average ${mood.average}/5 (${MOOD_META[moodFromScore(mood.average)!].label}) over ${mood.entries} entries` : 'No mood entries in this range'
                }
              />
              <div className="p-5">
                {mood && mood.entries > 0 ? (
                  <DailyLineChart
                    data={mood.daily}
                    series={[{ key: 'score', label: 'Mood score', color: 'var(--chart-1)', format: (v) => `${v} (${MOOD_META[moodFromScore(v)!]?.label})` }]}
                    caption={`Average daily mood, last ${days} days`}
                    yDomain={[1, 5]}
                    yTicks={[1, 2, 3, 4, 5]}
                    yTickFormat={(v) => MOOD_META[moodFromScore(v)!]?.label ?? ''}
                  />
                ) : (
                  <p className="py-16 text-center text-sm text-subtle">Log your mood to see a trend here.</p>
                )}
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Activity heatmap" description="Completed tasks + focus sessions per day, last 8 weeks" />
            <div className="p-5">
              <ActivityHeatmap days={data.heatmap} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-fg">By priority</h2>
              <BreakdownBars
                items={data.byPriority.map((p) => ({
                  label: PRIORITY_META[p.priority].label,
                  value: p.count,
                  color: p.priority === 'HIGH' ? 'var(--status-critical)' : p.priority === 'MEDIUM' ? 'var(--status-warning)' : 'var(--subtle)',
                }))}
              />
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-fg">By status</h2>
              <BreakdownBars items={data.byStatus.map((s) => ({ label: STATUS_META[s.status].label, value: s.count }))} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-fg">By category</h2>
              <BreakdownBars
                items={data.byCategory.slice(0, 7).map((c) => ({
                  label: c.name,
                  value: c.count,
                  icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />,
                }))}
              />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
