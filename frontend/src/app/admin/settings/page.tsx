'use client';

import { Megaphone } from 'lucide-react';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Textarea, Toggle } from '@/components/ui/form';
import { Card, CardHeader, PageHeader, Spinner } from '@/components/ui/misc';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { SystemSettings } from '@/lib/types';

function BroadcastCard() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { recipients } = await api.post<{ recipients: number }>('/admin/notifications/broadcast', { title: title.trim(), message: message.trim() });
      toast.success(`Notification sent to ${recipients} users`);
      setTitle('');
      setMessage('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Broadcast notification" description="Send an in-app system notification to every active user." />
      <form onSubmit={send} className="space-y-4 p-5">
        <Input label="Title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Message" required rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="flex justify-end">
          <Button type="submit" loading={sending} disabled={title.trim().length < 3 || message.trim().length < 3}>
            <Megaphone className="h-4 w-4" /> Send to all users
          </Button>
        </div>
      </form>
    </Card>
  );
}

export default function AdminSettingsPage() {
  const { data, mutate } = useSWR<SystemSettings>('/admin/settings');
  const [draft, setDraft] = useState<SystemSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await api.patch<SystemSettings>('/admin/settings', draft);
      await mutate(saved, { revalidate: false });
      toast.success('System settings saved');
    } catch (err) {
      toast.error(err instanceof ApiError && err.details?.length ? err.details.map((d) => `${d.field}: ${d.message}`).join(', ') : errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(draft) !== JSON.stringify(data);

  return (
    <>
      <PageHeader title="System settings" description="Platform-wide configuration. Changes apply to all users within seconds." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Platform" />
          {!draft ? (
            <Spinner />
          ) : (
            <div className="space-y-4 p-5">
              <Toggle label="Allow new registrations" description="When off, the sign-up page is closed." checked={draft.allowRegistration} onChange={(v) => setDraft({ ...draft, allowRegistration: v })} />
              <Toggle
                label="Maintenance mode"
                description="Normal users are blocked from the app (admins keep access)."
                checked={draft.maintenanceMode}
                onChange={(v) => setDraft({ ...draft, maintenanceMode: v })}
              />
              <Textarea
                label="Announcement banner"
                rows={2}
                maxLength={300}
                hint="Shown at the top of the public website and auth pages. Leave empty to hide."
                value={draft.announcement}
                onChange={(e) => setDraft({ ...draft, announcement: e.target.value })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Default focus minutes"
                  type="number"
                  min={5}
                  max={120}
                  hint="Applied to new accounts"
                  value={draft.defaultFocusMinutes}
                  onChange={(e) => setDraft({ ...draft, defaultFocusMinutes: Number(e.target.value) })}
                />
                <Input
                  label="Max tasks per user"
                  type="number"
                  min={10}
                  max={100000}
                  value={draft.maxTasksPerUser}
                  onChange={(e) => setDraft({ ...draft, maxTasksPerUser: Number(e.target.value) })}
                />
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
          )}
        </Card>
        <BroadcastCard />
      </div>
    </>
  );
}
