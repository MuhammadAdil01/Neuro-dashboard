import { clsx, type ClassValue } from 'clsx';
import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from 'date-fns';
import type { MoodLevel, Priority, TaskStatus } from './types';

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

const toDate = (d: string | Date) => (typeof d === 'string' ? parseISO(d) : d);

export function formatDate(d: string | Date | null | undefined, pattern = 'MMM d, yyyy') {
  if (!d) return '—';
  return format(toDate(d), pattern);
}

export function formatDateTime(d: string | Date | null | undefined, h24 = false) {
  if (!d) return '—';
  return format(toDate(d), h24 ? 'MMM d, yyyy HH:mm' : 'MMM d, yyyy h:mm a');
}

/** "Today 5:00 PM", "Tomorrow", "Mar 4" … */
export function formatDue(d: string | null) {
  if (!d) return null;
  const date = toDate(d);
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today ${time}`;
  if (isTomorrow(date)) return `Tomorrow ${time}`;
  if (isYesterday(date)) return `Yesterday ${time}`;
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy');
}

export const timeAgo = (d: string | Date) => formatDistanceToNowStrict(toDate(d), { addSuffix: true });

/** YYYY-MM-DD → short label for chart axes ("Mon", "Mar 4"). */
export function dayLabel(key: string, style: 'weekday' | 'short' = 'short') {
  const date = parseISO(`${key}T12:00:00`);
  return format(date, style === 'weekday' ? 'EEE' : 'MMM d');
}

export function minutesLabel(min: number) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** <input type="datetime-local"> value ↔ ISO conversion in the browser's local time zone. */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export const PRIORITY_META: Record<Priority, { label: string; className: string; dot: string }> = {
  HIGH: { label: 'High', className: 'bg-danger-soft text-danger', dot: 'bg-[var(--status-critical)]' },
  MEDIUM: { label: 'Medium', className: 'bg-warning-soft text-warning', dot: 'bg-[var(--status-warning)]' },
  LOW: { label: 'Low', className: 'bg-surface-2 text-muted', dot: 'bg-[var(--subtle)]' },
};

export const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  TODO: { label: 'To Do', className: 'bg-surface-2 text-muted' },
  IN_PROGRESS: { label: 'In Progress', className: 'bg-primary-soft text-primary' },
  COMPLETED: { label: 'Completed', className: 'bg-success-soft text-success' },
  CANCELLED: { label: 'Cancelled', className: 'bg-surface-2 text-subtle line-through' },
};

export const MOOD_META: Record<MoodLevel, { label: string; emoji: string; score: number }> = {
  GREAT: { label: 'Great', emoji: '😄', score: 5 },
  GOOD: { label: 'Good', emoji: '🙂', score: 4 },
  OKAY: { label: 'Okay', emoji: '😐', score: 3 },
  LOW: { label: 'Low', emoji: '😔', score: 2 },
  STRESSED: { label: 'Stressed', emoji: '😫', score: 1 },
};
export const MOODS = Object.keys(MOOD_META) as MoodLevel[];

export function moodFromScore(score: number | null): MoodLevel | null {
  if (score === null) return null;
  const rounded = Math.round(score);
  return MOODS.find((m) => MOOD_META[m].score === rounded) ?? null;
}

export const PROJECT_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#14b8a6', '#64748b'];

export const ACTIVITY_LABELS: Record<string, string> = {
  'task.created': 'Created task',
  'task.updated': 'Updated task',
  'task.completed': 'Completed task',
  'task.deleted': 'Deleted task',
  'project.created': 'Created project',
  'project.updated': 'Updated project',
  'project.deleted': 'Deleted project',
  'focus.completed': 'Finished a focus session',
  'mood.logged': 'Logged mood',
  'note.created': 'Created note',
  'note.deleted': 'Deleted note',
  'auth.register': 'Registered',
  'auth.login': 'Logged in',
  'auth.login_failed': 'Failed login',
  'auth.logout': 'Logged out',
  'auth.logout_all': 'Logged out everywhere',
  'auth.password_reset_requested': 'Requested password reset',
  'auth.password_reset': 'Reset password',
  'user.password_changed': 'Changed password',
  'user.profile_updated': 'Updated profile',
  'user.account_deleted': 'Deleted account',
  'user.data_exported': 'Exported data',
  'admin.user_status_changed': 'Changed user status',
  'admin.user_role_changed': 'Changed user role',
  'admin.category_changed': 'Changed category',
  'admin.settings_updated': 'Updated system settings',
  'admin.broadcast_sent': 'Sent broadcast',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
