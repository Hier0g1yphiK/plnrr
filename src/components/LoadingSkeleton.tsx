'use client';

/**
 * Lightweight CSS-only loading skeleton displayed during state hydration.
 * Matches the dark-mode-first aesthetic with a subtle pulse animation.
 * Reserves the same approximate space as the real content to prevent CLS.
 */
export function LoadingSkeleton() {
  return (
    <div
      className="flex flex-col flex-1 w-full animate-pulse"
      aria-label="Loading application"
      aria-busy="true"
      role="status"
    >
      {/* Navigation skeleton */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-lavender-900 min-h-[60px]">
        <div className="flex items-center gap-6">
          <div className="h-6 w-16 rounded bg-zinc-200 dark:bg-lavender-800/50" />
          <div className="flex gap-2">
            <div className="h-8 w-20 rounded-lg bg-zinc-200 dark:bg-lavender-800/30" />
            <div className="h-8 w-16 rounded-lg bg-zinc-200 dark:bg-lavender-800/30" />
          </div>
        </div>
        <div className="h-8 w-8 rounded-lg bg-zinc-200 dark:bg-lavender-800/30" />
      </div>

      {/* Content skeleton */}
      <div className="w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8 min-h-[400px]">
        <div className="space-y-4">
          {/* Card skeletons */}
          <div className="h-16 rounded-xl bg-zinc-200 dark:bg-lavender-800/20 border border-zinc-100 dark:border-lavender-800/30" />
          <div className="h-16 rounded-xl bg-zinc-200 dark:bg-lavender-800/20 border border-zinc-100 dark:border-lavender-800/30" />
          <div className="h-16 rounded-xl bg-zinc-200 dark:bg-lavender-800/20 border border-zinc-100 dark:border-lavender-800/30" />
        </div>
      </div>
    </div>
  );
}
