import { BarChart3, ShieldCheck, Timer } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { AnnouncementBar } from '@/components/layout/public-shell';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AnnouncementBar />
      <div className="grid flex-1 lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-fg lg:flex">
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10" aria-hidden />
          <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-white/5" aria-hidden />
          <span className="relative text-xl font-bold">NeuroTask</span>
          <div className="relative space-y-6">
            <h2 className="text-3xl font-bold leading-tight">Plan with clarity.<br />Focus with intent.</h2>
            <ul className="space-y-4 text-sm opacity-90">
              <li className="flex items-center gap-3"><Timer className="h-5 w-5" aria-hidden /> Pomodoro focus sessions linked to your tasks</li>
              <li className="flex items-center gap-3"><BarChart3 className="h-5 w-5" aria-hidden /> Streaks, heatmaps and trends from your real data</li>
              <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5" aria-hidden /> Private by default — only you see your data</li>
            </ul>
          </div>
          <p className="relative text-xs opacity-70">© {new Date().getFullYear()} NeuroTask Dashboard</p>
        </aside>
        <main className="flex flex-col px-4 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <Logo />
            <ThemeToggle />
          </div>
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
