'use client';

import { Coffee, Pause, Play, RotateCcw, SkipForward, Square, Timer, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { StatTile } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/form';
import { Badge, Card, CardHeader, EmptyState, PageHeader, Pagination, SegmentedControl } from '@/components/ui/misc';
import { useAuth } from '@/hooks/use-auth';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, errorMessage, pagedFetcher, qs, type Paged } from '@/lib/api';
import type { FocusSession, FocusStats, FocusType, Task } from '@/lib/types';
import { cn, formatDateTime, minutesLabel } from '@/lib/utils';

const MODES: { value: FocusType; label: string }[] = [
  { value: 'FOCUS', label: 'Focus' },
  { value: 'SHORT_BREAK', label: 'Short break' },
  { value: 'LONG_BREAK', label: 'Long break' },
];
const STORAGE_KEY = 'nt-focus-timer';

interface TimerState {
  sessionId: string | null;
  mode: FocusType;
  plannedSec: number;
  accumulatedMs: number; // focused time before the current run
  runningSince: number | null; // epoch ms, null when paused/idle
  taskId: string;
}

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    // audio not available
  }
}

const fmt = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export default function FocusPage() {
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const settings = user?.settings;
  const durations: Record<FocusType, number> = useMemo(
    () => ({
      FOCUS: settings?.focusMinutes ?? 25,
      SHORT_BREAK: settings?.shortBreakMinutes ?? 5,
      LONG_BREAK: settings?.longBreakMinutes ?? 15,
    }),
    [settings?.focusMinutes, settings?.shortBreakMinutes, settings?.longBreakMinutes],
  );

  const [state, setState] = useState<TimerState>({ sessionId: null, mode: 'FOCUS', plannedSec: durations.FOCUS * 60, accumulatedMs: 0, runningSince: null, taskId: '' });
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const completing = useRef(false);
  const restored = useRef(false);

  const { data: stats, mutate: mutateStats } = useSWR<FocusStats>('/focus-sessions/stats');
  const { data: history } = useSWR<Paged<FocusSession>>(`/focus-sessions${qs({ page, limit: 8 })}`, pagedFetcher, { keepPreviousData: true });
  const { data: tasks } = useSWR<Paged<Task>>('/tasks?view=active&limit=100&sortBy=dueDate&sortOrder=asc', pagedFetcher);

  // Restore a running timer after a reload, if the server still has it in progress
  useEffect(() => {
    if (restored.current || stats === undefined) return;
    restored.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as TimerState | null;
      if (saved?.sessionId && stats.active?.id === saved.sessionId) setState(saved);
      else if (!saved?.sessionId) setState((s) => ({ ...s, plannedSec: durations[s.mode] * 60 }));
    } catch {}
  }, [stats]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restored.current) return; // never overwrite saved state before it has been restored
    try {
      if (state.sessionId) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [state]);

  const elapsedMs = state.accumulatedMs + (state.runningSince ? now - state.runningSince : 0);
  const remaining = Math.max(0, state.plannedSec - elapsedMs / 1000);
  const progress = 1 - remaining / state.plannedSec;
  const running = state.runningSince !== null;
  const active = state.sessionId !== null;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    document.title = active ? `${fmt(remaining)} · ${MODES.find((m) => m.value === state.mode)!.label} · NeuroTask` : 'Focus · NeuroTask';
    return () => {
      document.title = 'NeuroTask';
    };
  }, [active, remaining, state.mode]);

  const refresh = useCallback(() => {
    mutateStats();
    invalidate('/focus-sessions', '/analytics', '/notifications');
  }, [mutateStats, invalidate]);

  const finish = useCallback(
    async (status: 'COMPLETED' | 'CANCELLED', s: TimerState, actualSeconds: number) => {
      if (!s.sessionId) return;
      setBusy(true);
      try {
        await api.patch(`/focus-sessions/${s.sessionId}`, { status, actualSeconds: Math.round(actualSeconds) });
        if (status === 'COMPLETED') {
          beep();
          toast.success(s.mode === 'FOCUS' ? 'Focus session complete! Take a break.' : 'Break over — ready to focus?');
        }
      } catch (err) {
        toast.error(errorMessage(err));
      } finally {
        setBusy(false);
        // Suggest the next mode: every 4th focus session earns a long break
        const completedToday = (stats?.today.sessions ?? 0) + (status === 'COMPLETED' && s.mode === 'FOCUS' ? 1 : 0);
        const nextMode: FocusType = status !== 'COMPLETED' ? s.mode : s.mode === 'FOCUS' ? (completedToday % 4 === 0 ? 'LONG_BREAK' : 'SHORT_BREAK') : 'FOCUS';
        setState({ sessionId: null, mode: nextMode, plannedSec: durations[nextMode] * 60, accumulatedMs: 0, runningSince: null, taskId: s.taskId });
        refresh();
      }
    },
    [stats, durations, refresh],
  );

  // Auto-complete when the countdown reaches zero
  useEffect(() => {
    if (active && running && remaining <= 0 && !completing.current) {
      completing.current = true;
      finish('COMPLETED', state, state.plannedSec).finally(() => (completing.current = false));
    }
  }, [active, running, remaining, state, finish]);

  const start = async () => {
    setBusy(true);
    try {
      const session = await api.post<FocusSession>('/focus-sessions', {
        type: state.mode,
        plannedMinutes: Math.round(state.plannedSec / 60),
        taskId: state.mode === 'FOCUS' && state.taskId ? state.taskId : null,
      });
      setNow(Date.now());
      setState((s) => ({ ...s, sessionId: session.id, accumulatedMs: 0, runningSince: Date.now() }));
      mutateStats();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pause = () => setState((s) => ({ ...s, accumulatedMs: s.accumulatedMs + (Date.now() - (s.runningSince ?? Date.now())), runningSince: null }));
  const resume = () => {
    setNow(Date.now());
    setState((s) => ({ ...s, runningSince: Date.now() }));
  };
  const reset = () => finish('CANCELLED', state, elapsedMs / 1000);
  const finishEarly = () => finish('COMPLETED', state, elapsedMs / 1000);

  const switchMode = (mode: FocusType) => {
    if (active) return;
    setState((s) => ({ ...s, mode, plannedSec: durations[mode] * 60, accumulatedMs: 0 }));
  };

  const deleteSession = async (id: string) => {
    try {
      await api.delete(`/focus-sessions/${id}`);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const R = 120;
  const C = 2 * Math.PI * R;
  const ringColor = state.mode === 'FOCUS' ? 'var(--primary)' : 'var(--chart-3)';

  return (
    <>
      <PageHeader title="Focus" description="Pomodoro sessions: focus deeply, then rest." />

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatTile label="Today" value={minutesLabel(stats?.today.minutes ?? 0)} sub={`${stats?.today.sessions ?? 0} sessions`} />
        <StatTile label="This week" value={minutesLabel(stats?.week.minutes ?? 0)} sub={`${stats?.week.sessions ?? 0} sessions`} />
        <StatTile label="All time" value={minutesLabel(stats?.allTime.minutes ?? 0)} sub={`${stats?.allTime.sessions ?? 0} sessions`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="flex flex-col items-center p-6 lg:col-span-3">
          <SegmentedControl ariaLabel="Timer mode" value={state.mode} onChange={switchMode} options={MODES} />

          <div className="relative my-8 aspect-square w-full max-w-[280px]">
            <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="140" cy="140" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="14" />
              <circle
                cx="140"
                cy="140"
                r={R}
                fill="none"
                stroke={ringColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
                style={{ transition: running ? 'stroke-dashoffset 0.25s linear' : undefined }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-bold tabular text-fg sm:text-6xl" role="timer" aria-live="off">
                {fmt(remaining)}
              </span>
              <span className="mt-1 flex items-center gap-1 text-sm text-muted">
                {state.mode === 'FOCUS' ? <Timer className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                {!active ? 'Ready' : running ? (state.mode === 'FOCUS' ? 'Focusing' : 'On a break') : 'Paused'}
              </span>
            </div>
          </div>

          {state.mode === 'FOCUS' && (
            <div className="mb-6 w-full max-w-sm">
              <label htmlFor="focus-task" className="mb-1.5 block text-center text-sm font-medium text-muted">
                Working on
              </label>
              <FilterSelect
                id="focus-task"
                className="sm:w-full"
                value={state.taskId}
                disabled={active}
                onChange={(e) => setState((s) => ({ ...s, taskId: e.target.value }))}
              >
                <option value="">No specific task</option>
                {tasks?.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </FilterSelect>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            {!active ? (
              <Button size="lg" onClick={start} loading={busy}>
                <Play className="h-5 w-5" /> Start
              </Button>
            ) : running ? (
              <Button size="lg" onClick={pause}>
                <Pause className="h-5 w-5" /> Pause
              </Button>
            ) : (
              <Button size="lg" onClick={resume}>
                <Play className="h-5 w-5" /> Resume
              </Button>
            )}
            {active && (
              <>
                <Button size="lg" variant="outline" onClick={finishEarly} disabled={busy}>
                  <SkipForward className="h-5 w-5" /> Finish
                </Button>
                <Button size="lg" variant="ghost" onClick={reset} disabled={busy}>
                  <RotateCcw className="h-5 w-5" /> Reset
                </Button>
              </>
            )}
          </div>
          <p className="mt-6 text-center text-xs text-subtle">
            {durations.FOCUS}/{durations.SHORT_BREAK}/{durations.LONG_BREAK} minute cycle · change durations in Settings · every 4th focus session earns a long break
          </p>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Session history" />
          {history?.data.length ? (
            <ul className="mt-3 divide-y divide-border">
              {history.data.map((s) => (
                <li key={s.id} className="group flex items-center gap-3 px-5 py-3">
                  <span
                    className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', s.type === 'FOCUS' ? 'bg-primary-soft text-primary' : 'bg-success-soft text-success')}
                    aria-hidden
                  >
                    {s.type === 'FOCUS' ? <Timer className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{s.task?.title ?? MODES.find((m) => m.value === s.type)!.label}</p>
                    <p className="text-xs text-muted">{formatDateTime(s.startedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-fg tabular">{minutesLabel(Math.round(s.actualSeconds / 60))}</p>
                    {s.status === 'COMPLETED' ? (
                      <Badge className="bg-success-soft text-success">Done</Badge>
                    ) : s.status === 'CANCELLED' ? (
                      <Badge className="bg-surface-2 text-subtle">Stopped</Badge>
                    ) : (
                      <Badge className="bg-primary-soft text-primary">
                        <Square className="h-2.5 w-2.5" /> Running
                      </Badge>
                    )}
                  </div>
                  {s.status !== 'IN_PROGRESS' && (
                    <button onClick={() => deleteSession(s.id)} className="rounded p-1 text-subtle opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100" aria-label="Delete session">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Timer} title="No sessions yet" description="Start your first focus session to build your history." />
          )}
          {history && <Pagination page={history.meta.page} totalPages={history.meta.totalPages} total={history.meta.total} onChange={setPage} />}
        </Card>
      </div>
    </>
  );
}
