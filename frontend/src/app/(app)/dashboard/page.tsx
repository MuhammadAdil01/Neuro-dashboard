'use client';

import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Flame, ListTodo, NotebookPen, Plus, Smile, Target, Timer } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { DailyBarChart, StatTile } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Badge, Card, CardHeader, EmptyState, ErrorState, Modal, Skeleton } from '@/components/ui/misc';
import { MoodPicker } from '@/features/mood/mood-picker';
import { TaskFormModal } from '@/features/tasks/task-form-modal';
import { useAuth } from '@/hooks/use-auth';
import type { Overview } from '@/lib/types';
import { ACTIVITY_LABELS, cn, formatDue, minutesLabel, MOOD_META, moodFromScore, PRIORITY_META, timeAgo } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<Overview>('/analytics/overview');
  const [taskOpen, setTaskOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);

  const quickActions = [
    { label: 'Add task', icon: Plus, onClick: () => setTaskOpen(true) },
    { label: 'Start focus', icon: Timer, onClick: () => router.push('/focus') },
    { label: 'Log mood', icon: Smile, onClick: () => setMoodOpen(true) },
    { label: 'Add note', icon: NotebookPen, onClick: () => router.push('/notes?new=1') },
  ];

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">
            {greeting()}, {user?.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-muted">Here’s how your productivity is shaping up.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {quickActions.map((a, i) => (
            <Button key={a.label} variant={i === 0 ? 'primary' : 'outline'} onClick={a.onClick}>
              <a.icon className="h-4 w-4" /> {a.label}
            </Button>
          ))}
        </div>
      </div>

      {error ? (
        <Card>
          <ErrorState message={error.message} onRetry={() => mutate()} />
        </Card>
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <section aria-label="Key metrics" className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Total tasks" value={data.tasks.total} sub={`${data.tasks.completionRate}% completed`} icon={<ListTodo className="h-4 w-4" />} />
            <StatTile label="Completed" value={data.tasks.completed} tone="success" icon={<CheckCircle2 className="h-4 w-4" />} sub="all time" />
            <StatTile label="Active" value={data.tasks.active} sub={`${data.tasks.inProgress} in progress`} icon={<Target className="h-4 w-4" />} />
            <StatTile label="High priority" value={data.tasks.highPriority} sub="open tasks" icon={<AlertTriangle className="h-4 w-4" />} />
            <StatTile
              label="Due today"
              value={data.tasks.dueToday}
              tone={data.tasks.overdue ? 'danger' : 'default'}
              sub={data.tasks.overdue ? `${data.tasks.overdue} overdue` : 'nothing overdue'}
              icon={<CalendarClock className="h-4 w-4" />}
            />
            <StatTile label="Streak" value={`${data.streak.current} ${data.streak.current === 1 ? 'day' : 'days'}`} sub={`Best: ${data.streak.longest} days`} icon={<Flame className="h-4 w-4" />} />
          </section>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader
                title="Tasks completed this week"
                description={`${data.weeklyCompletion.reduce((s, d) => s + d.completed, 0)} tasks in the last 7 days`}
                action={
                  <Link href="/analytics" className="text-sm font-medium text-primary hover:underline">
                    Analytics
                  </Link>
                }
              />
              <div className="p-5">
                <DailyBarChart
                  data={data.weeklyCompletion}
                  series={[{ key: 'completed', label: 'Completed', color: 'var(--chart-1)' }]}
                  caption="Tasks completed per day over the last 7 days"
                  weekday
                />
              </div>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Focus"
                  action={
                    <Link href="/focus" className="text-sm font-medium text-primary hover:underline">
                      Start
                    </Link>
                  }
                />
                <div className="grid grid-cols-3 gap-2 p-5 text-center">
                  <div>
                    <p className="text-xl font-bold text-fg">{minutesLabel(data.focus.todayMinutes)}</p>
                    <p className="text-xs text-muted">today</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-fg">{minutesLabel(data.focus.weekMinutes)}</p>
                    <p className="text-xs text-muted">this week</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-fg">{data.focus.weekSessions}</p>
                    <p className="text-xs text-muted">sessions</p>
                  </div>
                </div>
              </Card>
              <Card>
                <CardHeader
                  title="Mood"
                  action={
                    <button onClick={() => setMoodOpen(true)} className="text-sm font-medium text-primary hover:underline">
                      Log mood
                    </button>
                  }
                />
                <div className="p-5">
                  {data.mood.latest ? (
                    <div className="flex items-center gap-4">
                      <span className="text-4xl" aria-hidden>
                        {MOOD_META[data.mood.latest.mood].emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-fg">Feeling {MOOD_META[data.mood.latest.mood].label.toLowerCase()}</p>
                        <p className="text-xs text-muted">{timeAgo(data.mood.latest.loggedAt)}</p>
                        {data.mood.weekAverage !== null && (
                          <p className="mt-1 text-xs text-muted">
                            7-day average: <span className="font-medium text-fg">{data.mood.weekAverage}/5</span> ({MOOD_META[moodFromScore(data.mood.weekAverage)!].label})
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No mood logged yet. How are you feeling today?</p>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Upcoming tasks"
                description="Due today and in the next 7 days"
                action={
                  <Link href="/tasks?view=upcoming" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    View all <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              {data.upcomingTasks.length ? (
                <ul className="mt-3 divide-y divide-border">
                  {data.upcomingTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                      <span className={cn('h-2 w-2 shrink-0 rounded-full', PRIORITY_META[t.priority].dot)} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{t.title}</p>
                        <p className="text-xs text-muted">
                          {formatDue(t.dueDate)}
                          {t.project && ` · ${t.project.name}`}
                        </p>
                      </div>
                      <Badge className={PRIORITY_META[t.priority].className}>{PRIORITY_META[t.priority].label}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CalendarClock} title="Nothing due soon" description="Tasks with due dates in the next week will show up here." />
              )}
            </Card>

            <Card>
              <CardHeader title="Recent activity" />
              {data.recentActivity.length ? (
                <ol className="mt-3 divide-y divide-border">
                  {data.recentActivity.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span className="min-w-0 truncate text-fg">
                        {ACTIVITY_LABELS[a.action] ?? a.action}
                        {typeof a.details?.title === 'string' && <span className="text-muted"> · {a.details.title}</span>}
                        {typeof a.details?.name === 'string' && <span className="text-muted"> · {a.details.name}</span>}
                        {typeof a.details?.mood === 'string' && <span className="text-muted"> · {MOOD_META[a.details.mood as keyof typeof MOOD_META]?.label}</span>}
                        {typeof a.details?.minutes === 'number' && <span className="text-muted"> · {a.details.minutes} min</span>}
                      </span>
                      <span className="shrink-0 text-xs text-subtle">{timeAgo(a.createdAt)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState title="No activity yet" description="Your recent actions will appear here." />
              )}
            </Card>
          </div>
        </div>
      )}

      <TaskFormModal open={taskOpen} onClose={() => setTaskOpen(false)} />
      <Modal open={moodOpen} onClose={() => setMoodOpen(false)} title="How are you feeling?" description="Your mood history is private to you.">
        <MoodPicker onDone={() => setMoodOpen(false)} />
      </Modal>
    </>
  );
}
