'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/providers/theme-provider';
import { Button } from '@/components/ui/button';

/** Quick light/dark switch. The full LIGHT/DARK/SYSTEM choice lives in Settings. */
export function ThemeToggle({ onChange }: { onChange?: (t: 'LIGHT' | 'DARK') => void }) {
  const { resolved, setTheme } = useTheme();
  const next = resolved === 'dark' ? 'LIGHT' : 'DARK';
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next.toLowerCase()} mode`}
      onClick={() => {
        setTheme(next);
        onChange?.(next);
      }}
    >
      {resolved === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
