'use client';

import { useToast } from '@/lib/toast-context';
import type { Toast as ToastType, ToastVariant } from '@/lib/toast-context';

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

const variantStyles: Record<ToastVariant, string> = {
  warning:
    'bg-amber-50 dark:bg-amber-900/80 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100',
  info:
    'bg-zinc-50 dark:bg-zinc-800/90 border-zinc-300 dark:border-zinc-600 text-zinc-900 dark:text-zinc-100',
};

const iconColors: Record<ToastVariant, string> = {
  warning: 'text-amber-500 dark:text-amber-300',
  info: 'text-zinc-500 dark:text-zinc-300',
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastType;
  onDismiss: (id: string) => void;
}) {
  const Icon = toast.variant === 'warning' ? WarningIcon : InfoIcon;

  return (
    <div
      role={toast.variant === 'warning' ? 'alert' : 'status'}
      aria-live={toast.variant === 'warning' ? 'assertive' : 'polite'}
      className={`flex items-start gap-3 w-full max-w-sm px-4 py-3 rounded-lg border shadow-lg transition-all animate-[toast-slide-in_0.2s_ease-out] ${variantStyles[toast.variant]}`}
    >
      <span className={`shrink-0 mt-0.5 ${iconColors[toast.variant]}`}>
        <Icon />
      </span>
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center rounded-md opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
