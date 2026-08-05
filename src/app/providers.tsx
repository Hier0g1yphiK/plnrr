'use client';

import type { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { ThemeProvider } from '@/lib/theme-context';
import { ChecklistProvider } from '@/lib/checklist-context';
import { OrganizerProvider } from '@/lib/organizer-context';
import { ToastProvider } from '@/lib/toast-context';
import { ToastContainer } from '@/components/Toast';
import { HydrationProvider } from '@/lib/hydration-context';
import { ImportPrompt } from '@/components/ImportPrompt';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <HydrationProvider>
        <ThemeProvider>
          <ToastProvider>
            <ChecklistProvider>
              <OrganizerProvider>
                {children}
                <ImportPrompt />
                <ToastContainer />
              </OrganizerProvider>
            </ChecklistProvider>
          </ToastProvider>
        </ThemeProvider>
      </HydrationProvider>
    </SessionProvider>
  );
}
