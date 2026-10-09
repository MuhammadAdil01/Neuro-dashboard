'use client';

import { Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import type { PublicSettings } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ButtonLink } from '../ui/button';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function AnnouncementBar() {
  const { data } = useSWR<PublicSettings>('/public/settings', { shouldRetryOnError: false });
  if (!data?.announcement && !data?.maintenanceMode) return null;
  return (
    <div className="bg-primary px-4 py-2 text-center text-sm text-primary-fg">
      {data.maintenanceMode ? 'NeuroTask is currently undergoing maintenance. Some features may be unavailable.' : data.announcement}
    </div>
  );
}

function PublicNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const appHref = user?.role === 'ADMIN' ? '/admin' : '/dashboard';

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href ? 'text-fg' : 'text-muted hover:text-fg',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <ButtonLink href={appHref}>Open dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost">
                Log in
              </ButtonLink>
              <ButtonLink href="/register">Get started</ButtonLink>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button className="rounded-lg p-2 text-fg" onClick={() => setOpen(!open)} aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-border bg-surface px-4 pb-4 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-sm font-medium text-fg hover:bg-surface-2">
              {item.label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {user ? (
              <ButtonLink href={appHref} className="col-span-2">
                Open dashboard
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="outline">
                  Log in
                </ButtonLink>
                <ButtonLink href="/register">Get started</ButtonLink>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="text-sm text-muted">Plan, focus and understand your productivity — in one dashboard.</p>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Product</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/features" className="hover:text-fg">Features</Link></li>
            <li><Link href="/how-it-works" className="hover:text-fg">How it works</Link></li>
            <li><Link href="/register" className="hover:text-fg">Create account</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Project</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/about" className="hover:text-fg">About</Link></li>
            <li><Link href="/contact" className="hover:text-fg">Contact & support</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-fg">Account</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><Link href="/login" className="hover:text-fg">Log in</Link></li>
            <li><Link href="/forgot-password" className="hover:text-fg">Forgot password</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-subtle">
        © {new Date().getFullYear()} NeuroTask Dashboard · Final Year Project
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <AnnouncementBar />
      <PublicNav />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
