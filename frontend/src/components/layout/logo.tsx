import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ href = '/', className, compact }: { href?: string; className?: string; compact?: boolean }) {
  return (
    <Link href={href} className={cn('inline-flex items-center gap-2 font-bold tracking-tight text-fg', className)} aria-label="NeuroTask home">
      <svg viewBox="0 0 32 32" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--primary)" />
        <path d="M9 22V10l7 8 7-8v12" fill="none" stroke="var(--primary-fg)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {!compact && <span className="text-lg">NeuroTask</span>}
    </Link>
  );
}
