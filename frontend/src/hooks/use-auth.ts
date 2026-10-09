'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { api, ApiError } from '@/lib/api';
import type { User } from '@/lib/types';

export function useAuth() {
  const { data: user, error, isLoading, mutate } = useSWR<User, ApiError>('/users/me', {
    revalidateOnFocus: false,
  });
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Drop every cached response so the next user never sees stale data
      await globalMutate(() => true, undefined, { revalidate: false });
      router.replace('/login');
      router.refresh();
    }
  }, [globalMutate, router]);

  return {
    user,
    isLoading,
    error,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'ADMIN',
    mutate,
    logout,
  };
}
