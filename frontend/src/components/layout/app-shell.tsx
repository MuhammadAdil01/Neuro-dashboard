'use client';

import { Bell, LogOut, Menu, Shield, User as UserIcon, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import useSWR from 'swr';
import { useTheme } from '@/components/providers/theme-provider';
import { Avatar, Spinner } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { api, ApiError, setUnauthorizedHandler } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

export interface NavItem {
  href: string;
  label: string;
  icon: ElementType;
  exact?: boolean;
}

function NotificationBell() {
  const { data } = useSWR<{ unreadCount: number }>('/notifications/unread-count', { refreshInterval: 60_000 });
  const count = data?.unreadCount ?? 0;
  return (
    <Link
      href="/notifications"
      className="relative rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
      aria-label={count ? `Notifications, ${count} unread` : 'Notifications'}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white tabular">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}

function UserMenu() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const inAdmin = pathname.startsWith('/admin');

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  if (!user) return null;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-lg p-1 hover:bg-surface-2" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <Avatar name={user.name} url={user.avatarUrl} size={32} />
        <span className="hidden max-w-32 truncate text-sm font-medium text-fg sm:block">{user.name}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          <div className="border-b border-border px-4 py-3">
            <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <div className="p-1">
            <Link role="menuitem" href={inAdmin ? '/admin/profile' : '/profile'} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2">
              <UserIcon className="h-4 w-4" /> Profile
            </Link>
            {isAdmin && (
              <Link role="menuitem" href={inAdmin ? '/dashboard' : '/admin'} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg hover:bg-surface-2">
                <Shield className="h-4 w-4" /> {inAdmin ? 'Switch to my workspace' : 'Admin panel'}
              </Link>
            )}
            <button role="menuitem" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger hover:bg-danger-soft">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5" aria-label="App">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
          >
            <item.icon className="h-[18px] w-[18px]" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function MaintenanceScreen() {
  const { logout } = useAuth();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <Logo />
      <h1 className="text-2xl font-bold text-fg">We’ll be right back</h1>
      <p className="max-w-md text-muted">NeuroTask is undergoing scheduled maintenance. Your data is safe — please try again shortly.</p>
      <button onClick={logout} className="text-sm font-medium text-primary hover:underline">
        Log out
      </button>
    </div>
  );
}

/** Authenticated layout: verifies the session with the API, then renders sidebar + top bar. */
export function AppShell({ nav, children, area, requireAdmin }: { nav: NavItem[]; children: ReactNode; area: string; requireAdmin?: boolean }) {
  const { user, error, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Session expired mid-use → clear the cookie and go to login
  useEffect(() => {
    setUnauthorizedHandler(() => {
      api.post('/auth/logout').catch(() => {});
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    });
    return () => setUnauthorizedHandler(null);
  }, [router, pathname]);

  useEffect(() => {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      api.post('/auth/logout').catch(() => {});
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [error, router, pathname]);

  useEffect(() => {
    if (user && requireAdmin && user.role !== 'ADMIN') router.replace('/dashboard');
  }, [user, requireAdmin, router]);

  // Apply the theme saved in the user's settings
  useEffect(() => {
    if (user?.settings?.theme) setTheme(user.settings.theme);
  }, [user?.settings?.theme, setTheme]);

  useEffect(() => setMobileOpen(false), [pathname]);

  if (error instanceof ApiError && error.status === 503) return <MaintenanceScreen />;
  if (isLoading || !user || (requireAdmin && user.role !== 'ADMIN')) {
    if (error && !(error instanceof ApiError && error.status === 401)) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-medium text-fg">Can’t reach NeuroTask right now.</p>
          <p className="text-sm text-muted">{error.message}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      );
    }
    return <Spinner className="min-h-screen" label="Loading your workspace" />;
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-4">
        <Logo href={requireAdmin ? '/admin' : '/dashboard'} />
        <button className="rounded-lg p-2 text-muted lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="px-7 pb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">{area}</p>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <SidebarNav items={nav} onNavigate={() => setMobileOpen(false)} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-border bg-surface shadow-xl">{sidebar}</aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-2">
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="lg:hidden">
            <Logo compact href={requireAdmin ? '/admin' : '/dashboard'} />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle onChange={(t) => api.patch('/users/me/settings', { theme: t }).catch(() => {})} />
          {!requireAdmin && <NotificationBell />}
          <UserMenu />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {children}
      </main>
    </div>
  );
}
