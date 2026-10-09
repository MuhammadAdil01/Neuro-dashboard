'use client';

import { BarChart3, Bell, CalendarDays, CheckSquare, FolderKanban, LayoutDashboard, NotebookPen, Settings, Smile, Timer, User } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layout/app-shell';

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/focus', label: 'Focus', icon: Timer },
  { href: '/mood', label: 'Mood', icon: Smile },
  { href: '/notes', label: 'Notes', icon: NotebookPen },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function UserAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} area="Workspace">
      {children}
    </AppShell>
  );
}
