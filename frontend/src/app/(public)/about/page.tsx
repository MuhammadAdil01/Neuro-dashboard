import { GraduationCap, Layers, Target, Users } from 'lucide-react';
import type { Metadata } from 'next';
import { SectionHeading } from '@/components/marketing/sections';

export const metadata: Metadata = { title: 'About' };

const STACK = [
  ['Frontend', 'Next.js (App Router), React, TypeScript, Tailwind CSS, SWR, Recharts'],
  ['Backend', 'Node.js, Express.js, TypeScript, Zod validation, JWT + bcrypt'],
  ['Database', 'Supabase PostgreSQL with Prisma ORM and versioned migrations'],
  ['Security', 'httpOnly sessions, RBAC, ownership checks, rate limiting, Helmet, RLS lockdown'],
  ['Quality', 'Jest + Supertest unit, integration and security tests'],
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
      <SectionHeading
        eyebrow="About the project"
        title="Built to answer one question: is my effort paying off?"
        text="NeuroTask Dashboard is a final year project that demonstrates a complete, production-style full-stack productivity platform."
      />

      <div className="mt-14 grid gap-5 sm:grid-cols-3">
        {[
          { icon: Target, title: 'Purpose', text: 'Replace a scattered set of tools with one place to organise work, maintain focus and understand productivity trends.' },
          { icon: Users, title: 'Audience', text: 'Students managing coursework and exams, and professionals balancing projects, deadlines and wellbeing.' },
          { icon: GraduationCap, title: 'Academic value', text: 'Authentication, RBAC, relational modelling, REST APIs, validation, testing and deployment in one coherent system.' },
        ].map((c) => (
          <div key={c.title} className="rounded-2xl border border-border bg-surface p-6">
            <c.icon className="h-6 w-6 text-primary" aria-hidden />
            <h2 className="mt-4 font-semibold text-fg">{c.title}</h2>
            <p className="mt-2 text-sm text-muted">{c.text}</p>
          </div>
        ))}
      </div>

      <section className="mt-16">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <Layers className="h-5 w-5 text-primary" aria-hidden /> Technology
        </h2>
        <dl className="mt-5 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {STACK.map(([k, v]) => (
            <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-4">
              <dt className="text-sm font-semibold text-fg">{k}</dt>
              <dd className="text-sm text-muted sm:col-span-3">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-16 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-semibold text-fg">Privacy by default</h2>
        <p className="mt-2 text-sm text-muted">
          Your tasks, notes, mood entries and focus sessions are private. Administrators manage accounts and see only platform-wide totals —
          never the contents of your records. You can export or permanently delete your data at any time from Settings.
        </p>
      </section>
    </div>
  );
}
