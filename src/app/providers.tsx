'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from '@/lib/theme-context';
import { ChecklistProvider } from '@/lib/checklist-context';
import { OrganizerProvider } from '@/lib/organizer-context';
import { ToastProvider } from '@/lib/toast-context';
import { ToastContainer } from '@/components/Toast';
import { HydrationProvider } from '@/lib/hydration-context';

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <HydrationProvider>
      <ThemeProvider>
        <ToastProvider>
          <ChecklistProvider>
            <OrganizerProvider>
              {children}
              <ToastContainer />
            </OrganizerProvider>
          </ChecklistProvider>
        </ToastProvider>
      </ThemeProvider>
    </HydrationProvider>
  );
}
