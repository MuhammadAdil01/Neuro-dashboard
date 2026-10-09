import { ArrowRight, CheckCircle2, Flame, Timer } from 'lucide-react';
import Link from 'next/link';
import { PlatformStats } from '@/components/marketing/platform-stats';
import { FEATURES, SectionHeading, STEPS } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/button';

function HeroPreview() {
  const bars = [3, 5, 2, 6, 4, 7, 5];
  return (
    <div className="relative mx-auto w-full max-w-xl" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-tr from-primary/20 via-transparent to-[var(--chart-3)]/20 blur-2xl" />
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-subtle">Good morning</p>
            <p className="font-semibold text-fg">Your productivity today</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
            <Flame className="h-3.5 w-3.5" /> 9-day streak
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            ['Completed', '15'],
            ['Active', '9'],
            ['Focus', '2h 5m'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border p-3">
              <p className="text-xs text-subtle">{k}</p>
              <p className="mt-1 text-xl font-bold text-fg">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-border p-3">
          <p className="mb-3 text-xs font-medium text-muted">Tasks completed this week</p>
          <div className="flex h-24 items-end gap-2">
            {bars.map((b, i) => (
              <div key={i} className="flex-1 rounded-t-[4px] bg-[var(--chart-1)]" style={{ height: `${b * 13}%` }} />
            ))}
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {[
            ['Design ERD for FYP', 'High', true],
            ['Revise Operating Systems', 'Medium', false],
            ['Pomodoro: write API docs', 'Focus', false],
          ].map(([t, p, done]) => (
            <div key={t as string} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              {p === 'Focus' ? <Timer className="h-4 w-4 text-primary" /> : <CheckCircle2 className={done ? 'h-4 w-4 text-success' : 'h-4 w-4 text-subtle'} />}
              <span className={done ? 'flex-1 text-subtle line-through' : 'flex-1 text-fg'}>{t}</span>
              <span className="text-xs text-muted">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="h-2 w-2 rounded-full bg-[var(--status-good)]" /> Tasks · Focus · Mood · Analytics
            </span>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-fg sm:text-5xl lg:text-6xl">
              Your work, your focus, <span className="text-primary">one dashboard.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              NeuroTask brings tasks, projects, Pomodoro focus sessions, mood tracking, notes and analytics together — so students and
              professionals can see whether their daily effort is really adding up.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/register" size="lg">
                Get started free <ArrowRight className="h-4 w-4" />
              </ButtonLink>
              <ButtonLink href="/features" size="lg" variant="outline">
                Explore features
              </ButtonLink>
            </div>
            <PlatformStats />
          </div>
          <HeroPreview />
        </div>
      </section>

      <section className="border-t border-border bg-surface py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Everything in one place"
            title="Stop juggling five different apps"
            text="Tasks, reminders, focus timers, notes and progress tracking usually live in separate tools. NeuroTask connects them so your data tells one story."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.slice(0, 6).map((f) => (
              <div key={f.title} className="rounded-xl border border-border bg-bg p-6">
                <div className="mb-4 inline-flex rounded-lg bg-primary-soft p-2.5 text-primary">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold text-fg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/features" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              See all features <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading eyebrow="How it works" title="From sign-up to insight in five steps" />
          <ol className="mt-12 grid gap-5 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-border bg-surface p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="mx-auto max-w-6xl rounded-3xl bg-primary px-6 py-14 text-center text-primary-fg sm:px-12">
          <h2 className="text-3xl font-bold tracking-tight">Ready to make every day count?</h2>
          <p className="mx-auto mt-3 max-w-xl opacity-90">Create your free account and start your first focus session in under a minute.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/register" className="inline-flex h-12 items-center rounded-lg bg-white px-6 font-semibold text-[#4338ca] hover:bg-white/90">
              Create account
            </Link>
            <Link href="/login" className="inline-flex h-12 items-center rounded-lg border border-white/40 px-6 font-semibold hover:bg-white/10">
              I already have one
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
