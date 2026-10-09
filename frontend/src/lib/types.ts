export type Role = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'INACTIVE';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MoodLevel = 'GREAT' | 'GOOD' | 'OKAY' | 'LOW' | 'STRESSED';
export type FocusType = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
export type NotificationType = 'TASK_REMINDER' | 'TASK_DUE' | 'TASK_COMPLETED' | 'FOCUS' | 'SYSTEM';

export interface UserSettings {
  theme: 'LIGHT' | 'DARK' | 'SYSTEM';
  timezone: string;
  dateFormat: string;
  timeFormat24h: boolean;
  weekStartsOn: number;
  emailNotifications: boolean;
  taskReminders: boolean;
  reminderLeadMinutes: number;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  avatarUrl: string | null;
  bio: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  settings?: UserSettings | null;
}

export interface Ref {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  isOverdue: boolean;
  category: Ref | null;
  project: Ref | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: 'ACTIVE' | 'ARCHIVED';
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount: number;
  completedCount: number;
  inProgressCount: number;
  overdueCount: number;
  progress: number;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  scope: 'global' | 'personal';
  createdAt: string;
  taskCount?: number;
}

export interface FocusSession {
  id: string;
  type: FocusType;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  plannedMinutes: number;
  actualSeconds: number;
  startedAt: string;
  endedAt: string | null;
  task: { id: string; title: string } | null;
}

export interface FocusStats {
  today: { sessions: number; minutes: number };
  week: { sessions: number; minutes: number };
  allTime: { sessions: number; minutes: number };
  active: FocusSession | null;
}

export interface MoodLog {
  id: string;
  mood: MoodLevel;
  score: number;
  note: string | null;
  loggedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  body: string | null;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface Overview {
  timezone: string;
  tasks: {
    total: number;
    completed: number;
    active: number;
    todo: number;
    inProgress: number;
    cancelled: number;
    highPriority: number;
    overdue: number;
    dueToday: number;
    completionRate: number;
  };
  streak: { current: number; longest: number };
  weeklyCompletion: { date: string; completed: number }[];
  focus: { todayMinutes: number; weekMinutes: number; weekSessions: number; daily: { date: string; minutes: number }[] };
  mood: {
    latest: { mood: MoodLevel; note: string | null; loggedAt: string } | null;
    weekAverage: number | null;
    daily: { date: string; score: number | null }[];
  };
  upcomingTasks: (Pick<Task, 'id' | 'title' | 'priority' | 'status' | 'dueDate'> & { project: Ref | null })[];
  recentActivity: ActivityItem[];
  unreadNotifications: number;
}

export interface Productivity {
  days: number;
  timezone: string;
  daily: { date: string; created: number; completed: number; focusMinutes: number }[];
  heatmap: { date: string; count: number; tasks: number; focusSessions: number }[];
  byPriority: { priority: Priority; count: number }[];
  byStatus: { status: TaskStatus; count: number }[];
  byCategory: { categoryId: string | null; name: string; color: string; count: number }[];
  summary: {
    tasksCompleted: number;
    tasksCreated: number;
    focusMinutes: number;
    focusSessions: number;
    avgCompletedPerDay: number;
    avgFocusMinutesPerDay: number;
    bestDay: { date: string; completed: number } | null;
    activeDays: number;
    currentStreak: number;
    longestStreak: number;
  };
}

export interface MoodAnalytics {
  days: number;
  daily: { date: string; score: number | null }[];
  distribution: { mood: MoodLevel; count: number }[];
  average: number | null;
  entries: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient_data';
}

export interface PublicSettings {
  allowRegistration: boolean;
  maintenanceMode: boolean;
  announcement: string;
}

export interface SystemSettings extends PublicSettings {
  defaultFocusMinutes: number;
  maxTasksPerUser: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: Role;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskCount?: number;
}

export interface AdminUserDetail extends AdminUser {
  stats: {
    tasks: { total: number; completed: number };
    projects: number;
    notes: number;
    moodLogs: number;
    focusSessions: number;
    focusMinutes: number;
  };
  securityEvents: { id: string; action: string; ipAddress: string | null; createdAt: string }[];
}

export interface ActivityLog {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface AdminStats {
  users: { total: number; active: number; inactive: number; admins: number; activeLast7d: number; newLast30d: number };
  tasks: { total: number; completed: number; open: number; completionRate: number };
  projects: number;
  notes: number;
  moodLogs: number;
  focus: { sessions: number; hours: number };
  trend: { date: string; signups: number; completedTasks: number }[];
  recentEvents: ActivityLog[];
}

export interface AdminReport {
  days: number;
  daily: {
    date: string;
    signups: number;
    totalUsers: number;
    tasksCreated: number;
    tasksCompleted: number;
    focusMinutes: number;
    activeUsers: number;
  }[];
  totals: { signups: number; tasksCreated: number; tasksCompleted: number; focusHours: number; completionRate: number };
  moodDistribution: { mood: MoodLevel; count: number }[];
  priorityDistribution: { priority: Priority; count: number }[];
  topCategories: { name: string; color: string; count: number }[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}
