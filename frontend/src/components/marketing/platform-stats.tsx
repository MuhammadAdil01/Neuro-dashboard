'use client';

import useSWR from 'swr';

/** Live, aggregate platform numbers from the database (no personal data). */
export function PlatformStats() {
  const { data } = useSWR<{ users: number; tasksCompleted: number; focusHours: number }>('/public/stats', { shouldRetryOnError: false });
  if (!data) return null;
  const items = [
    [data.users.toLocaleString(), 'active users'],
    [data.tasksCompleted.toLocaleString(), 'tasks completed'],
    [data.focusHours.toLocaleString(), 'hours of focus'],
  ];
  return (
    <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
      {items.map(([value, label]) => (
        <div key={label}>
          <dt className="sr-only">{label}</dt>
          <dd className="text-2xl font-bold text-fg">{value}</dd>
          <dd className="text-xs text-muted">{label}</dd>
        </div>
      ))}
    </dl>
  );
}
