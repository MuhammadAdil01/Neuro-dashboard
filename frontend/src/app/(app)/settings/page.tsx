'use client';

import { Download, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { useTheme } from '@/components/providers/theme-provider';
import { Button, buttonClass } from '@/components/ui/button';
import { Input, Select, Toggle } from '@/components/ui/form';
import { Card, CardHeader, ConfirmDialog, PageHeader, Spinner } from '@/components/ui/misc';
import { SecurityCard } from '@/features/account/security-card';
import { useAuth } from '@/hooks/use-auth';
import { useCategories, useInvalidate } from '@/hooks/use-lookups';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Category, UserSettings } from '@/lib/types';

const TIMEZONES: string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
})();

function PreferencesCard() {
  const { mutate: mutateMe } = useAuth();
  const { setTheme } = useTheme();
  const { data, mutate } = useSWR<UserSettings>('/users/me/settings');
  const [draft, setDraft] = useState<UserSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(data), [draft, data]);
  if (!draft) return <Spinner />;
  const set = <K extends keyof UserSettings>(k: K, v: UserSettings[K]) => setDraft({ ...draft, [k]: v });

  const save = async () => {
    setSaving(true);
    try {
      const { updatedAt: _u, ...payload } = draft as UserSettings & { updatedAt?: string };
      const saved = await api.patch<UserSettings>('/users/me/settings', payload);
      await mutate(saved, { revalidate: false });
      setTheme(saved.theme);
      mutateMe();
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof ApiError && err.details?.length ? err.details.map((d) => d.message).join(', ') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Preferences" description="Appearance, time, notifications and focus timer." />
      <div className="space-y-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Theme" value={draft.theme} onChange={(e) => set('theme', e.target.value as UserSettings['theme'])}>
            <option value="SYSTEM">Match system</option>
            <option value="LIGHT">Light</option>
            <option value="DARK">Dark</option>
          </Select>
          <Select label="Time zone" value={draft.timezone} onChange={(e) => set('timezone', e.target.value)} hint="Used for streaks, daily charts and reminders.">
            {(TIMEZONES.includes(draft.timezone) ? TIMEZONES : [draft.timezone, ...TIMEZONES]).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
          <Select label="Date format" value={draft.dateFormat} onChange={(e) => set('dateFormat', e.target.value)}>
            <option value="MMM d, yyyy">Oct 9, 2026</option>
            <option value="dd/MM/yyyy">09/10/2026</option>
            <option value="MM/dd/yyyy">10/09/2026</option>
            <option value="yyyy-MM-dd">2026-10-09</option>
          </Select>
          <Select label="Week starts on" value={draft.weekStartsOn} onChange={(e) => set('weekStartsOn', Number(e.target.value))}>
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </Select>
        </div>
        <Toggle label="24-hour clock" checked={draft.timeFormat24h} onChange={(v) => set('timeFormat24h', v)} />

        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-semibold text-fg">Notifications</h3>
          <Toggle label="Task reminders" description="In-app reminders before tasks are due and alerts when they become overdue." checked={draft.taskReminders} onChange={(v) => set('taskReminders', v)} />
          <Toggle label="Email notifications" description="Receive important account emails (password resets are always sent)." checked={draft.emailNotifications} onChange={(v) => set('emailNotifications', v)} />
          <Select
            label="Remind me"
            className="mt-2 max-w-xs"
            value={draft.reminderLeadMinutes}
            disabled={!draft.taskReminders}
            onChange={(e) => set('reminderLeadMinutes', Number(e.target.value))}
          >
            <option value={15}>15 minutes before</option>
            <option value={30}>30 minutes before</option>
            <option value={60}>1 hour before</option>
            <option value={180}>3 hours before</option>
            <option value={1440}>1 day before</option>
          </Select>
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="mb-3 text-sm font-semibold text-fg">Focus timer (minutes)</h3>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Focus" type="number" min={1} max={120} value={draft.focusMinutes} onChange={(e) => set('focusMinutes', Number(e.target.value))} />
            <Input label="Short break" type="number" min={1} max={60} value={draft.shortBreakMinutes} onChange={(e) => set('shortBreakMinutes', Number(e.target.value))} />
            <Input label="Long break" type="number" min={1} max={120} value={draft.longBreakMinutes} onChange={(e) => set('longBreakMinutes', Number(e.target.value))} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(data!)}>
            Discard
          </Button>
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Save settings
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CategoriesCard() {
  const { data } = useCategories();
  const invalidate = useInvalidate();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [deleting, setDeleting] = useState<Category | null>(null);
  const personal = data?.filter((c) => c.scope === 'personal') ?? [];

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post('/categories', { name: name.trim(), color });
      setName('');
      invalidate('/categories');
      toast.success('Category added');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/categories/${deleting.id}`);
      invalidate('/categories', '/tasks');
      toast.success('Category deleted');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Card>
      <CardHeader title="My categories" description="Personal categories in addition to the shared ones." />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {data
            ?.filter((c) => c.scope === 'global')
            .map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} aria-hidden /> {c.name}
              </span>
            ))}
        </div>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {personal.length ? (
            personal.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-fg">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                  {c.name}
                  <span className="text-xs text-subtle">{c.taskCount ?? 0} tasks</span>
                </span>
                <button onClick={() => setDeleting(c)} className="rounded p-1 text-subtle hover:text-danger" aria-label={`Delete category ${c.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))
          ) : (
            <li className="px-3 py-3 text-sm text-subtle">No personal categories yet.</li>
          )}
        </ul>
        <form onSubmit={add} className="flex gap-2">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-surface p-1" aria-label="Category color" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="New category name"
            aria-label="New category name"
            className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-primary focus:outline-none"
          />
          <Button type="submit" disabled={!name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
      </div>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete category?"
        message={<>Tasks in “{deleting?.name}” will keep existing without a category.</>}
      />
    </Card>
  );
}

function DataCard() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.delete('/users/me', { password });
      toast.success('Your account has been deleted');
      await logout();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Your data" description="Export everything you have stored, or delete your account." />
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <a href="/api/v1/export?format=json" className={buttonClass('outline')} download>
            <Download className="h-4 w-4" /> Export all (JSON)
          </a>
          {(['tasks', 'projects', 'focus', 'moods', 'notes'] as const).map((t) => (
            <a key={t} href={`/api/v1/export?format=csv&type=${t}`} className={buttonClass('ghost', 'sm')} download>
              {t[0].toUpperCase() + t.slice(1)} CSV
            </a>
          ))}
        </div>
        <div className="rounded-lg border border-danger/30 bg-danger-soft p-4">
          <h3 className="text-sm font-semibold text-danger">Delete account</h3>
          <p className="mt-1 text-sm text-muted">Permanently deletes your account and every task, project, note, mood entry and focus session. This cannot be undone.</p>
          <Button variant="danger" className="mt-3" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={remove}
        loading={busy}
        confirmLabel="Delete forever"
        title="Delete your account?"
        message="Enter your password to confirm. All of your data will be permanently erased."
      >
        <Input className="mt-4" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error ?? undefined} />
      </ConfirmDialog>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Customise NeuroTask and manage your account." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <PreferencesCard />
        </div>
        <div className="space-y-6">
          <SecurityCard />
          <CategoriesCard />
          <DataCard />
        </div>
      </div>
    </>
  );
}
