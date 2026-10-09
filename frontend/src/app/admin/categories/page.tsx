'use client';

import { Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Toggle } from '@/components/ui/form';
import { Badge, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner } from '@/components/ui/misc';
import { api, errorMessage, pagedFetcher, type Paged } from '@/lib/api';
import type { Category } from '@/lib/types';

type AdminCategory = Category & { taskCount: number };

function CategoryModal({ category, open, onClose, onSaved }: { category: AdminCategory | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#6366f1');
  const [isActive, setActive] = useState(category?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (category) await api.patch(`/categories/${category.id}`, { name: name.trim(), color, isActive });
      else await api.post('/categories', { name: name.trim(), color, global: true });
      toast.success(category ? 'Category updated' : 'Category created');
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={category ? 'Edit category' : 'New global category'} description="Global categories are available to every user.">
      <form onSubmit={save} className="space-y-4">
        <Input label="Name" required maxLength={50} value={name} onChange={(e) => setName(e.target.value)} error={error ?? undefined} />
        <div className="flex items-center gap-3">
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-surface p-1" aria-label="Category color" />
          <span className="text-sm text-muted">{color}</span>
        </div>
        {category && <Toggle label="Active" description="Inactive categories can’t be assigned to new tasks." checked={isActive} onChange={setActive} />}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AdminCategoriesPage() {
  const { data, error, mutate } = useSWR<Paged<AdminCategory>>('/admin/categories', pagedFetcher);
  const personalCount = data?.meta.personalCategories as number | undefined;
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  const remove = async () => {
    if (!deleting) return;
    try {
      await api.delete(`/categories/${deleting.id}`);
      toast.success('Category deleted');
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  const toggle = async (c: AdminCategory) => {
    try {
      await api.patch(`/categories/${c.id}`, { isActive: !c.isActive });
      mutate();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Categories"
        description={personalCount !== undefined ? `Global task categories shared by all users · users have also created ${personalCount} personal categories` : 'Global task categories shared by all users'}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        }
      />
      <Card>
        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : !data ? (
          <Spinner />
        ) : !data.data.length ? (
          <EmptyState icon={Tags} title="No global categories" />
        ) : (
          <ul className="divide-y divide-border">
            {data.data.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-fg">{c.name}</p>
                  <p className="text-xs text-muted">Used by {c.taskCount} tasks</p>
                </div>
                <Badge className={c.isActive ? 'bg-success-soft text-success' : 'bg-surface-2 text-subtle'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
                <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                  {c.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <button onClick={() => setEditing(c)} className="rounded-lg p-1.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label={`Edit ${c.name}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleting(c)} className="rounded-lg p-1.5 text-subtle hover:bg-danger-soft hover:text-danger" aria-label={`Delete ${c.name}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {(creating || editing) && (
        <CategoryModal
          key={editing?.id ?? 'new'}
          open
          category={editing}
          onSaved={() => mutate()}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Delete category?"
        message={<>“{deleting?.name}” is used by {deleting?.taskCount} tasks. They will keep existing without a category. Consider deactivating instead.</>}
      />
    </>
  );
}
