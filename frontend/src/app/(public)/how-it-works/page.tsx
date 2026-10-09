import type { Metadata } from 'next';
import { SectionHeading, STEPS } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'How it works' };

const FLOW = ['Browser (Next.js)', 'REST API (Express)', 'Validation & authorization', 'Supabase PostgreSQL'];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:py-20">
      <SectionHeading eyebrow="How it works" title="A simple routine that compounds" text="NeuroTask fits into your day in five steps." />
      <ol className="relative mt-14 space-y-8 border-l-2 border-border pl-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <span className="absolute -left-[3.05rem] flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-fg ring-4 ring-bg">
              {i + 1}
            </span>
            <h2 className="text-lg font-semibold text-fg">{s.title}</h2>
            <p className="mt-1 text-muted">{s.text}</p>
          </li>
        ))}
      </ol>

      <section className="mt-20 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-fg">What happens behind the scenes</h2>
        <p className="mt-2 text-sm text-muted">
          Every action you take is sent to the NeuroTask API, which checks who you are, confirms you own the record, validates the data and
          stores it in a PostgreSQL database. Nothing important lives only in your browser.
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          {FLOW.map((step, i) => (
            <div key={step} className="flex flex-1 items-center gap-3">
              <div className="flex-1 rounded-xl border border-border bg-bg px-4 py-3 text-center text-sm font-medium text-fg">{step}</div>
              {i < FLOW.length - 1 && <span className="hidden text-subtle sm:inline" aria-hidden>→</span>}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 text-center">
        <ButtonLink href="/register" size="lg">
          Create your account
        </ButtonLink>
      </div>
    </div>
  );
}
