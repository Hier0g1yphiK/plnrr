'use client';

interface InlineErrorProps {
  message: string | null | undefined;
  className?: string;
}

/**
 * Reusable inline validation error component.
 * Renders red text adjacent to form fields in both light and dark modes.
 * Includes role="alert" for accessibility (screen readers announce changes).
 *
 * Usage:
 *   <InlineError message={error} />
 *   <InlineError message={capacityError} className="mt-2" />
 */
export function InlineError({ message, className = '' }: InlineErrorProps) {
  if (!message) return null;

  return (
    <p
      className={`text-sm font-body text-red-500 dark:text-red-400 ${className}`.trim()}
      role="alert"
    >
      {message}
    </p>
  );
}
