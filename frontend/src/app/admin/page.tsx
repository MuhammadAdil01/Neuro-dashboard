'use client';

import { CheckCircle2, FolderKanban, NotebookPen, Smile, Timer, UserCheck, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import useSWR from 'swr';
import { DailyBarChart, StatTile } from '@/components/charts/charts';
import { Card, CardHeader, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import type { AdminStats } from '@/lib/types';
import { ACTIVITY_LABELS, cn, timeAgo } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { data, error, mutate } = useSWR<AdminStats>('/admin/stats', { refreshInterval: 60_000 });

  return (
    <>
      <PageHeader title="Admin dashboard" description="Platform health and usage at a glance." />
      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="User metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total users" value={data.users.total} sub={`${data.users.admins} admins`} icon={<Users className="h-4 w-4" />} />
            <StatTile label="Active accounts" value={data.users.active} sub={`${data.users.inactive} deactivated`} icon={<UserCheck className="h-4 w-4" />} />
            <StatTile label="Active last 7 days" value={data.users.activeLast7d} sub="logged in recently" icon={<UserCheck className="h-4 w-4" />} />
            <StatTile label="New (30 days)" value={data.users.newLast30d} icon={<UserPlus className="h-4 w-4" />} />
          </section>
          <section aria-label="Content metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Tasks" value={data.tasks.total} sub={`${data.tasks.completionRate}% completed · ${data.tasks.open} open`} icon={<CheckCircle2 className="h-4 w-4" />} />
            <StatTile label="Projects" value={data.projects} icon={<FolderKanban className="h-4 w-4" />} />
            <StatTile label="Focus" value={`${data.focus.hours}h`} sub={`${data.focus.sessions} sessions`} icon={<Timer className="h-4 w-4" />} />
            <StatTile label="Notes · Moods" value={`${data.notes} · ${data.moodLogs}`} icon={<NotebookPen className="h-4 w-4" />} sub={<span className="inline-flex items-center gap-1"><Smile className="h-3 w-3" /> counts only — content stays private</span>} />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Sign-ups" description="New accounts per day, last 14 days" />
              <div className="p-5">
                <DailyBarChart data={data.trend} series={[{ key: 'signups', label: 'Sign-ups', color: 'var(--chart-1)' }]} caption="New user sign-ups per day" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Task completions" description="Tasks completed platform-wide, last 14 days" />
              <div className="p-5">
                <DailyBarChart data={data.trend} series={[{ key: 'completedTasks', label: 'Completed tasks', color: 'var(--chart-3)' }]} caption="Tasks completed per day" />
              </div>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Recent security & admin events"
              action={
                <Link href="/admin/activity" className="text-sm font-medium text-primary hover:underline">
                  All logs
                </Link>
              }
            />
            <ul className="mt-3 divide-y divide-border">
              {data.recentEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className={cn('font-medium', e.action === 'auth.login_failed' ? 'text-danger' : 'text-fg')}>{ACTIVITY_LABELS[e.action] ?? e.action}</span>
                    <span className="text-muted"> · {e.user?.email ?? 'unknown'}</span>
                  </span>
                  <span className="shrink-0 text-xs text-subtle">{timeAgo(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
