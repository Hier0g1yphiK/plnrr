'use client';

import { useTheme } from '@/lib/theme-context';

export type ActiveTab = 'checklist' | 'weekly';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-lavender-300 dark:text-zinc-400 dark:hover:text-lavender-300 transition-colors"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

export function Navigation({ activeTab, onTabChange }: NavigationProps) {
  function handleTabKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next: ActiveTab = activeTab === 'checklist' ? 'weekly' : 'checklist';
      onTabChange(next);
    }
  }

  return (
    <nav className="flex items-center justify-between px-4 py-2 min-h-[60px] bg-white dark:bg-lavender-950 border-b border-zinc-200 dark:border-lavender-900" aria-label="Main navigation">
      <div className="flex items-center gap-6">
        {/* Brand */}
        <span className="font-display text-xl font-semibold text-lavender-500 dark:text-lavender-300 select-none">
          plnrr
        </span>

        {/* Tab buttons */}
        <div className="flex items-center gap-1" role="tablist" aria-label="Main views">
          <button
            onClick={() => onTabChange('checklist')}
            onKeyDown={handleTabKeyDown}
            className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'checklist'
                ? 'text-lavender-400 border-b-2 border-lavender-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'checklist'}
            role="tab"
            id="tab-checklist"
            aria-controls="tabpanel-checklist"
            tabIndex={activeTab === 'checklist' ? 0 : -1}
          >
            Checklist
          </button>
          <button
            onClick={() => onTabChange('weekly')}
            onKeyDown={handleTabKeyDown}
            className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'weekly'
                ? 'text-lavender-400 border-b-2 border-lavender-400'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            aria-selected={activeTab === 'weekly'}
            role="tab"
            id="tab-weekly"
            aria-controls="tabpanel-weekly"
            tabIndex={activeTab === 'weekly' ? 0 : -1}
          >
            Weekly
          </button>
        </div>
      </div>

      {/* Theme toggle */}
      <ThemeToggle />
    </nav>
  );
}
