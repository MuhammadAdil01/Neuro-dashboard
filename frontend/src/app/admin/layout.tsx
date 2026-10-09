'use client';

import { FileBarChart, LayoutDashboard, Mail, ScrollText, Settings, Tags, User, Users } from 'lucide-react';
import { AppShell, type NavItem } from '@/components/layout/app-shell';

const NAV: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/categories', label: 'Categories', icon: Tags },
  { href: '/admin/reports', label: 'Reports', icon: FileBarChart },
  { href: '/admin/activity', label: 'Activity logs', icon: ScrollText },
  { href: '/admin/messages', label: 'Messages', icon: Mail },
  { href: '/admin/settings', label: 'System settings', icon: Settings },
  { href: '/admin/profile', label: 'Profile & security', icon: User },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell nav={NAV} area="Admin panel" requireAdmin>
      {children}
    </AppShell>
  );
}
