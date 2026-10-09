'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { Category, Project } from '@/lib/types';

export const useCategories = () => useSWR<Category[]>('/categories');
export const useActiveProjects = () => useSWR<Project[]>('/projects?status=ACTIVE');

/** Revalidates every cached key starting with one of the prefixes (e.g. after a task changes). */
export function useInvalidate() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (...prefixes: string[]) =>
      mutate((key) => typeof key === 'string' && prefixes.some((p) => key.startsWith(p)), undefined, { revalidate: true }),
    [mutate],
  );
}

/** Invalidates everything derived from tasks. */
export const TASK_KEYS = ['/tasks', '/projects', '/analytics', '/notifications', '/categories', '/focus-sessions'];

export function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
