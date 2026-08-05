'use client';

import { useState } from 'react';
import { AppProvider } from './providers';
import { useHydration } from '@/lib/hydration-context';
import { Navigation, type ActiveTab } from '@/components/Navigation';
import MainContent from '@/components/MainContent';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';

function AppShell() {
  const { hydrated } = useHydration();
  const [activeTab, setActiveTab] = useState<ActiveTab>('checklist');

  if (!hydrated) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
      <MainContent activeTab={activeTab} />
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
