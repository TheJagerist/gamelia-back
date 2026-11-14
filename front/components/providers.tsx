'use client';
import { Suspense } from 'react';
import { SessionProvider } from '@/lib/session';
import { ToastProvider } from './toast';
import { Shell } from './shell';
import { ListSkeleton } from './ui';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider>
        <Shell>
          <Suspense fallback={<ListSkeleton />}>{children}</Suspense>
        </Shell>
      </SessionProvider>
    </ToastProvider>
  );
}
