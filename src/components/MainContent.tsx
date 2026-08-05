'use client'

import { useRef, useEffect } from 'react'
import { ChecklistView } from './checklist/ChecklistView'
import { OrganizerView } from './organizer/OrganizerView'

interface MainContentProps {
  activeTab: 'checklist' | 'weekly'
}

export default function MainContent({ activeTab }: MainContentProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);

  // Focus the panel container on tab switch (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Small delay to allow the new view to render, then focus
    const timer = setTimeout(() => {
      panelRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  return (
    <main className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 min-h-[400px]">
      <div className="grid grid-cols-1 md:grid-cols-7 lg:grid-cols-7 gap-4 min-h-[350px]">
        {activeTab === 'checklist' ? (
          <div
            ref={panelRef}
            className="col-span-1 md:col-span-7 lg:col-span-7 min-h-[200px] outline-none"
            role="tabpanel"
            id="tabpanel-checklist"
            aria-labelledby="tab-checklist"
            tabIndex={-1}
          >
            <ChecklistView />
          </div>
        ) : (
          <div
            ref={panelRef}
            className="col-span-1 md:col-span-7 lg:col-span-7 min-h-[200px] outline-none"
            role="tabpanel"
            id="tabpanel-weekly"
            aria-labelledby="tab-weekly"
            tabIndex={-1}
          >
            <OrganizerView />
          </div>
        )}
      </div>
    </main>
  )
}
