import { BarChart3, Bell, CalendarDays, CheckCircle2, FolderKanban, NotebookPen, ShieldCheck, Smile, Timer } from 'lucide-react';
import type { ReactNode } from 'react';

export const FEATURES = [
  {
    icon: CheckCircle2,
    title: 'Task management',
    text: 'Create tasks with priorities, statuses, categories and due dates. Search, filter, sort and paginate thousands of tasks instantly.',
    points: ['High / Medium / Low priority', 'To Do → In Progress → Completed', 'Overdue and due-today views'],
  },
  {
    icon: FolderKanban,
    title: 'Projects',
    text: 'Group related tasks into projects and watch progress bars fill up as you complete work.',
    points: ['Live progress and task counts', 'Overdue indicators', 'Archive finished projects'],
  },
  {
    icon: CalendarDays,
    title: 'Calendar',
    text: 'See every deadline on a monthly calendar and know exactly what is coming next.',
    points: ['Month view with task chips', 'Click a day to see its tasks', 'Add tasks for any date'],
  },
  {
    icon: Timer,
    title: 'Focus / Pomodoro',
    text: 'A 25/5/15 Pomodoro timer with a visual ring, pause and resume, and a full session history.',
    points: ['Link sessions to tasks', 'Custom durations', 'Daily and weekly focus totals'],
  },
  {
    icon: Smile,
    title: 'Mood tracking',
    text: 'Log how you feel in two taps, add an optional note and spot patterns between mood and output.',
    points: ['Five-level mood scale', 'Private history', 'Mood trend analytics'],
  },
  {
    icon: NotebookPen,
    title: 'Notes',
    text: 'Capture ideas, meeting notes and study summaries right next to your tasks.',
    points: ['Pin important notes', 'Full-text search', 'Always private to you'],
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    text: 'Completion trends, an eight-week activity heatmap, focus time and mood trends — all computed from your real data.',
    points: ['Productivity streaks', 'Priority & category breakdowns', 'Export to JSON / CSV'],
  },
  {
    icon: Bell,
    title: 'Notifications',
    text: 'Due-soon reminders and overdue alerts arrive automatically, with read/unread tracking.',
    points: ['Configurable reminder lead time', 'Mark one or all as read', 'System announcements'],
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    text: 'Hashed passwords, httpOnly sessions, role-based access and strict data ownership on every request.',
    points: ['Admin & user roles', 'Rate-limited sign-in', 'Your data is only yours'],
  },
];

export function SectionHeading({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-fg sm:text-4xl">{title}</h2>
      {text && <p className="mt-4 text-lg text-muted">{text}</p>}
    </div>
  );
}

export const STEPS = [
  { title: 'Create your free account', text: 'Register with your name, email and a strong password. Your private workspace is ready instantly.' },
  { title: 'Organise your work', text: 'Add tasks with priorities and due dates, group them into projects and tag them with categories.' },
  { title: 'Focus in sessions', text: 'Start a Pomodoro session for a task. NeuroTask records every completed session automatically.' },
  { title: 'Check in with yourself', text: 'Log your mood and jot down notes so your productivity data has context.' },
  { title: 'Learn from your data', text: 'Your dashboard and analytics turn completed tasks, focus time and moods into streaks, trends and insights.' },
];
