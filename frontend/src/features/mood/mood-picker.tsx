'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, errorMessage } from '@/lib/api';
import type { MoodLevel } from '@/lib/types';
import { cn, MOOD_META, MOODS } from '@/lib/utils';

export function MoodPicker({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const [mood, setMood] = useState<MoodLevel | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();

  const save = async () => {
    if (!mood) return;
    setSaving(true);
    try {
      await api.post('/moods', { mood, note: note.trim() || null });
      toast.success(`Mood logged: ${MOOD_META[mood].label}`);
      setMood(null);
      setNote('');
      invalidate('/moods', '/analytics');
      onDone?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="How are you feeling?" className="grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={mood === m}
            onClick={() => setMood(m)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-all',
              mood === m ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50 hover:bg-surface-2',
            )}
          >
            <span className={compact ? 'text-xl' : 'text-2xl'} aria-hidden>
              {MOOD_META[m].emoji}
            </span>
            <span className="text-[11px] font-medium text-fg">{MOOD_META[m].label}</span>
          </button>
        ))}
      </div>
      {mood && (
        <>
          <Textarea label="Note (optional)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What’s influencing your mood?" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMood(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save} loading={saving}>
              Save mood
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
