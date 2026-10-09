import { Check, X } from 'lucide-react';
import { passwordRules } from '@/lib/forms';
import { cn } from '@/lib/utils';

export function PasswordChecklist({ value }: { value: string }) {
  return (
    <ul className="grid grid-cols-2 gap-1 text-xs" aria-label="Password requirements">
      {passwordRules.checks.map((c) => {
        const ok = c.test(value);
        return (
          <li key={c.label} className={cn('flex items-center gap-1', ok ? 'text-success' : 'text-subtle')}>
            {ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
            {c.label}
          </li>
        );
      })}
    </ul>
  );
}

