'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { BreakdownBars, DailyBarChart, DailyLineChart, StatTile } from '@/components/charts/charts';
import { Card, CardHeader, ErrorState, PageHeader, SegmentedControl, Skeleton } from '@/components/ui/misc';
import type { AdminReport } from '@/lib/types';
import { MOOD_META, PRIORITY_META } from '@/lib/utils';

export default function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const { data, error, mutate } = useSWR<AdminReport>(`/admin/reports?days=${days}`, { keepPreviousData: true });

  return (
    <>
      <PageHeader
        title="Reports"
        description="Platform growth, engagement and productivity trends (UTC days)."
        actions={
          <SegmentedControl
            ariaLabel="Report range"
            value={days}
            onChange={setDays}
            options={[
              { value: 7, label: '7 days' },
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
            ]}
          />
        }
      />
      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-label="Totals">
            <StatTile label="New users" value={data.totals.signups} />
            <StatTile label="Tasks created" value={data.totals.tasksCreated} />
            <StatTile label="Tasks completed" value={data.totals.tasksCompleted} />
            <StatTile label="Completion rate" value={`${data.totals.completionRate}%`} sub="completed / created" />
            <StatTile label="Focus hours" value={data.totals.focusHours} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="User growth" description="Total registered users" />
              <div className="p-5">
                <DailyLineChart data={data.daily} series={[{ key: 'totalUsers', label: 'Total users', color: 'var(--chart-1)' }]} caption="Cumulative registered users per day" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Daily active users" description="Distinct users with recorded activity" />
              <div className="p-5">
                <DailyBarChart data={data.daily} series={[{ key: 'activeUsers', label: 'Active users', color: 'var(--chart-1)' }]} caption="Daily active users" weekday={days === 7} />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader title="Task activity" description="Tasks created vs completed per day" />
            <div className="p-5">
              <DailyBarChart
                data={data.daily}
                series={[
                  { key: 'tasksCreated', label: 'Created', color: 'var(--chart-1)' },
                  { key: 'tasksCompleted', label: 'Completed', color: 'var(--chart-2)' },
                ]}
                caption="Tasks created and completed per day"
                weekday={days === 7}
                height={280}
              />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-fg">Focus minutes</h2>
              <DailyBarChart data={data.daily} series={[{ key: 'focusMinutes', label: 'Focus minutes', color: 'var(--chart-3)' }]} caption="Focus minutes per day" height={200} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-fg">New tasks by priority</h2>
              <BreakdownBars
                items={data.priorityDistribution.map((p) => ({
                  label: PRIORITY_META[p.priority].label,
                  value: p.count,
                  color: p.priority === 'HIGH' ? 'var(--status-critical)' : p.priority === 'MEDIUM' ? 'var(--status-warning)' : 'var(--subtle)',
                }))}
              />
            </Card>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold text-fg">Mood distribution</h2>
              <BreakdownBars items={data.moodDistribution.map((m) => ({ label: MOOD_META[m.mood].label, value: m.count, icon: <span aria-hidden>{MOOD_META[m.mood].emoji}</span> }))} />
            </Card>
          </div>

          <Card className="p-5">
            <h2 className="mb-4 font-semibold text-fg">Most used categories (all time)</h2>
            <BreakdownBars
              items={data.topCategories.map((c) => ({ label: c.name, value: c.count, icon: <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden /> }))}
            />
          </Card>
        </div>
      )}
    </>
  );
}
