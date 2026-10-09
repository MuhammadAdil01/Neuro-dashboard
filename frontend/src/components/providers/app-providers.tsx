'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { SWRConfig } from 'swr';
import { ApiError, fetcher } from '@/lib/api';
import { ThemeProvider, useTheme } from './theme-provider';

function ThemedToaster() {
  const { resolved } = useTheme();
  return <Toaster theme={resolved} position="top-right" richColors closeButton />;
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SWRConfig
        value={{
          fetcher,
          revalidateOnFocus: true,
          // Never retry auth/permission/validation failures
          shouldRetryOnError: (err) => !(err instanceof ApiError && err.status > 0 && err.status < 500),
          errorRetryCount: 2,
        }}
      >
        {children}
        <ThemedToaster />
      </SWRConfig>
    </ThemeProvider>
  );
}
