'use client';

import { Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { FilterSelect } from '@/components/ui/form';
import { Avatar, Badge, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton } from '@/components/ui/misc';
import { useDebounced } from '@/hooks/use-lookups';
import { pagedFetcher, qs, type Paged } from '@/lib/api';
import type { AdminUser } from '@/lib/types';
import { formatDate, timeAgo } from '@/lib/utils';

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [sort, setSort] = useState('createdAt:desc');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search);
  useEffect(() => setPage(1), [debounced, status, role, sort]);

  const [sortBy, sortOrder] = sort.split(':');
  const { data, error, isLoading, mutate } = useSWR<Paged<AdminUser>>(`/admin/users${qs({ page, limit: 15, search: debounced, status, role, sortBy, sortOrder })}`, pagedFetcher, {
    keepPreviousData: true,
  });

  return (
    <>
      <PageHeader title="Users" description="Search, review and manage accounts." />
      <Card>
        <div className="flex flex-col gap-2 border-b border-border p-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search users"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-sm text-fg placeholder:text-subtle focus:border-primary focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </FilterSelect>
            <FilterSelect value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
              <option value="">All roles</option>
              <option value="USER">Users</option>
              <option value="ADMIN">Admins</option>
            </FilterSelect>
            <FilterSelect value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort users">
              <option value="createdAt:desc">Newest</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="name:asc">Name A–Z</option>
              <option value="lastLoginAt:desc">Last login</option>
            </FilterSelect>
          </div>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={() => mutate()} />
        ) : isLoading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !data?.data.length ? (
          <EmptyState icon={Users} title="No users found" description="Try different filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Tasks</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium">Last login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.data.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                        <Avatar name={u.name} url={u.avatarUrl} size={32} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-fg hover:text-primary">{u.name}</span>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={u.role === 'ADMIN' ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-muted'}>{u.role === 'ADMIN' ? 'Admin' : 'User'}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={u.status === 'ACTIVE' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}>{u.status === 'ACTIVE' ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular text-fg">{u.taskCount ?? 0}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-muted">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.meta.page} totalPages={data.meta.totalPages} total={data.meta.total} onChange={setPage} />}
      </Card>
    </>
  );
}
