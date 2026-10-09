'use client';

import { Pencil, Smile, Trash2 } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { BreakdownBars, DailyLineChart } from '@/components/charts/charts';
import { Button } from '@/components/ui/button';
import { Select, Textarea } from '@/components/ui/form';
import { Card, CardHeader, ConfirmDialog, EmptyState, Modal, PageHeader, Pagination, SegmentedControl } from '@/components/ui/misc';
import { MoodPicker } from '@/features/mood/mood-picker';
import { useInvalidate } from '@/hooks/use-lookups';
import { api, errorMessage, pagedFetcher, qs, type Paged } from '@/lib/api';
import type { MoodAnalytics, MoodLevel, MoodLog } from '@/lib/types';
import { formatDateTime, MOOD_META, MOODS, moodFromScore } from '@/lib/utils';

const TREND_LABEL: Record<MoodAnalytics['trend'], string> = {
  improving: '↗ Improving',
  declining: '↘ Declining',
  stable: '→ Stable',
  insufficient_data: 'Not enough data yet',
};

function EditMoodModal({ entry, onClose }: { entry: MoodLog | null; onClose: () => void }) {
  const invalidate = useInvalidate();
  const [mood, setMood] = useState<MoodLevel>(entry?.mood ?? 'OKAY');
  const [note, setNote] = useState(entry?.note ?? '');
  const [saving, setSaving] = useState(false);
  if (!entry) return null;

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/moods/${entry.id}`, { mood, note: note.trim() || null });
      toast.success('Mood updated');
      invalidate('/moods', '/analytics');
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Edit mood entry" description={formatDateTime(entry.loggedAt)}>
      <div className="space-y-4">
        <Select label="Mood" value={mood} onChange={(e) => setMood(e.target.value as MoodLevel)}>
          {MOODS.map((m) => (
            <option key={m} value={m}>
              {MOOD_META[m].emoji} {MOOD_META[m].label}
            </option>
          ))}
        </Select>
        <Textarea label="Note" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function MoodPage() {
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<MoodLog | null>(null);
  const [deleting, setDeleting] = useState<MoodLog | null>(null);
  const [busy, setBusy] = useState(false);
  const invalidate = useInvalidate();

  const { data: analytics } = useSWR<MoodAnalytics>(`/analytics/mood?days=${days}`);
  const { data: history } = useSWR<Paged<MoodLog>>(`/moods${qs({ page, limit: 10 })}`, pagedFetcher, { keepPreviousData: true });

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/moods/${deleting.id}`);
      toast.success('Mood entry deleted');
      setDeleting(null);
      invalidate('/moods', '/analytics');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const avgMood = moodFromScore(analytics?.average ?? null);

  return (
    <>
      <PageHeader title="Mood" description="Track how you feel and see how it relates to your productivity." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-fg">How are you feeling right now?</h2>
          <MoodPicker />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Mood trend"
            description={
              analytics && analytics.average !== null ? (
                <>
                  Average {analytics.average}/5 {avgMood && `(${MOOD_META[avgMood].label})`} · {analytics.entries} entries · {TREND_LABEL[analytics.trend]}
                </>
              ) : (
                'Daily average mood score (1 = Stressed, 5 = Great)'
              )
            }
            action={
              <SegmentedControl
                ariaLabel="Range"
                value={days}
                onChange={setDays}
                options={[
                  { value: 7, label: '7d' },
                  { value: 30, label: '30d' },
                  { value: 90, label: '90d' },
                ]}
              />
            }
          />
          <div className="p-5">
            {analytics && analytics.entries > 0 ? (
              <DailyLineChart
                data={analytics.daily}
                series={[{ key: 'score', label: 'Mood score', color: 'var(--chart-1)', format: (v) => `${v} (${MOOD_META[moodFromScore(v)!]?.label})` }]}
                caption={`Average daily mood score over the last ${days} days`}
                yDomain={[1, 5]}
                yTicks={[1, 2, 3, 4, 5]}
                yTickFormat={(v) => MOOD_META[moodFromScore(v)!]?.label ?? ''}
              />
            ) : (
              <EmptyState icon={Smile} title="No mood data in this range" description="Log your mood to see your trend." />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold text-fg">Distribution ({days} days)</h2>
          <BreakdownBars
            items={(analytics?.distribution ?? []).map((d) => ({
              label: MOOD_META[d.mood].label,
              value: d.count,
              icon: <span aria-hidden>{MOOD_META[d.mood].emoji}</span>,
            }))}
          />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="History" />
          {history?.data.length ? (
            <ul className="mt-3 divide-y divide-border">
              {history.data.map((m) => (
                <li key={m.id} className="group flex items-start gap-3 px-5 py-3">
                  <span className="text-2xl" aria-hidden>
                    {MOOD_META[m.mood].emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-fg">{MOOD_META[m.mood].label}</p>
                    {m.note && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{m.note}</p>}
                    <p className="mt-0.5 text-xs text-subtle">{formatDateTime(m.loggedAt)}</p>
                  </div>
                  <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                    <button onClick={() => setEditing(m)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Edit mood entry">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDeleting(m)} className="rounded-lg p-1.5 text-subtle hover:bg-danger-soft hover:text-danger" aria-label="Delete mood entry">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Smile} title="No entries yet" description="Your mood log is private to you." />
          )}
          {history && <Pagination page={history.meta.page} totalPages={history.meta.totalPages} total={history.meta.total} onChange={setPage} />}
        </Card>
      </div>

      {editing && <EditMoodModal key={editing.id} entry={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} loading={busy} title="Delete mood entry?" message="This entry will be permanently removed." />
    </>
  );
}
