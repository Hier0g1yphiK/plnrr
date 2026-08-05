'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/lib/theme-context';
import { useToast } from '@/lib/toast-context';
import { formatUserDisplay } from '@/lib/user-display';
import type { ThemeName } from '@/lib/types';

export type ActiveTab = 'checklist' | 'weekly';

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

// === Theme Picker ===

const THEME_OPTIONS: { value: ThemeName; label: string; icon: string; description: string }[] = [
  { value: 'fairy-light', label: 'Fairy Garden', icon: '🌸', description: 'Light & whimsical' },
  { value: 'fairy-dark', label: 'Fairy Night', icon: '🌙', description: 'Dark & magical' },
  { value: 'circuit-light', label: 'Circuit', icon: '⚡', description: 'Light & technical' },
  { value: 'circuit-dark', label: 'Terminal', icon: '💻', description: 'Dark & focused' },
];

function PaletteIcon() {
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
      <circle cx="13.5" cy="6.5" r="2" />
      <circle cx="17.5" cy="10.5" r="2" />
      <circle cx="8.5" cy="7.5" r="2" />
      <circle cx="6.5" cy="12.5" r="2" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  );
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-theme-text-muted hover:text-theme-accent transition-colors"
        aria-label="Change theme"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <PaletteIcon />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-theme-border bg-theme-surface shadow-xl py-2 z-50"
          role="listbox"
          aria-label="Select theme"
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                setTheme(option.value);
                setOpen(false);
              }}
              className={`w-full min-h-[44px] px-4 py-2.5 flex items-center gap-3 text-left transition-colors hover:bg-theme-accent-subtle ${
                theme === option.value ? 'bg-theme-accent-subtle' : ''
              }`}
              role="option"
              aria-selected={theme === option.value}
            >
              <span className="text-lg" aria-hidden="true">{option.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${theme === option.value ? 'text-theme-accent' : 'text-theme-text'}`}>
                  {option.label}
                </div>
                <div className="text-xs text-theme-text-faint">{option.description}</div>
              </div>
              {theme === option.value && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-theme-accent shrink-0">
                  <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
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
    <nav className="flex items-center justify-between px-4 py-2 min-h-[60px] bg-theme-surface border-b border-theme-border" aria-label="Main navigation">
      <div className="flex items-center gap-6">
        {/* Brand */}
        <span className="font-display text-xl font-semibold text-theme-accent select-none">
          plnrr
        </span>

        {/* Tab buttons */}
        <div className="flex items-center gap-1" role="tablist" aria-label="Main views">
          <button
            onClick={() => onTabChange('checklist')}
            onKeyDown={handleTabKeyDown}
            className={`min-w-[44px] min-h-[44px] px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'checklist'
                ? 'text-theme-accent border-b-2 border-theme-accent'
                : 'text-theme-text-muted hover:text-theme-text'
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
                ? 'text-theme-accent border-b-2 border-theme-accent'
                : 'text-theme-text-muted hover:text-theme-text'
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

      {/* Session UI + Theme picker */}
      <div className="flex items-center gap-3">
        <SessionUI />
        <ThemePicker />
      </div>
    </nav>
  );
}

// === Session UI ===

function SessionUI() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const [signingOut, setSigningOut] = useState(false);

  if (!session?.user) return null;

  const displayName = formatUserDisplay(session.user.name, session.user.email);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut({ callbackUrl: '/auth/signin' });
    } catch {
      addToast('Sign-out failed. Please try again.', 'warning');
      setSigningOut(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-theme-text-muted truncate max-w-[180px]" title={session.user.name || session.user.email || undefined}>
        {displayName}
      </span>
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Sign out"
      >
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}
