import { Check } from 'lucide-react';
import type { Metadata } from 'next';
import { FEATURES, SectionHeading } from '@/components/marketing/sections';
import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Features' };

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to plan, focus and improve"
        text="Each module works on its own, and together they power the analytics that show how you are really doing."
      />
      <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 inline-flex w-fit rounded-xl bg-primary-soft p-3 text-primary">
              <f.icon className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-fg">{f.title}</h2>
            <p className="mt-2 text-sm text-muted">{f.text}</p>
            <ul className="mt-4 space-y-2">
              {f.points.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-fg">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden /> {p}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <div className="mt-14 text-center">
        <ButtonLink href="/register" size="lg">
          Start using NeuroTask
        </ButtonLink>
      </div>
    </div>
  );
}
