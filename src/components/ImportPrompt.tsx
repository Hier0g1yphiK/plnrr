'use client';

import { useState, useEffect, useCallback } from 'react';
import { isImportEligible, hasLocalStorageData, runImport } from '@/lib/importer';
import type { ImportResult } from '@/lib/importer';
import { importUserData } from '@/lib/actions';
import { useToast } from '@/lib/toast-context';

type PromptState =
  | 'checking'
  | 'hidden'
  | 'prompt'
  | 'importing'
  | 'success'
  | 'partial-failure'
  | 'error';

const MAX_RETRIES = 3;

export function ImportPrompt() {
  const [state, setState] = useState<PromptState>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { addToast } = useToast();

  // On mount, check eligibility
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const eligible = await isImportEligible();
        if (cancelled) return;

        if (!eligible) {
          setState('hidden');
          return;
        }

        const hasData = hasLocalStorageData();
        if (!hasData) {
          setState('hidden');
          return;
        }

        setState('prompt');
      } catch {
        if (!cancelled) setState('hidden');
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  const handleImport = useCallback(async () => {
    setState('importing');

    const result = await runImport();
    setImportResult(result);

    if (result.success) {
      setState('success');
      addToast('Data imported successfully!', 'info');
      // Auto-dismiss after 2 seconds
      setTimeout(() => {
        setState('hidden');
      }, 2000);
    } else if (result.checklistImported || result.organizerImported) {
      // Partial success: some data imported, some failed
      setState('partial-failure');
    } else {
      // Full failure
      setRetryCount((prev) => prev + 1);
      setState('error');
    }
  }, [addToast]);

  const handleRetry = useCallback(async () => {
    setState('importing');

    const result = await runImport();
    setImportResult(result);

    if (result.success) {
      setState('success');
      addToast('Data imported successfully!', 'info');
      setTimeout(() => {
        setState('hidden');
      }, 2000);
    } else if (result.checklistImported || result.organizerImported) {
      setState('partial-failure');
    } else {
      setRetryCount((prev) => prev + 1);
      setState('error');
    }
  }, [addToast]);

  const handleSkip = useCallback(async () => {
    setState('importing');
    try {
      // Call importUserData with empty defaults to set importCompleted flag
      await importUserData(
        { version: 1, templates: [], activeChecklist: null },
        { version: 1, tasks: [] }
      );
    } catch {
      // Even if the skip call fails, hide the prompt to avoid blocking the user
    }
    setState('hidden');
  }, []);

  // Don't render anything while checking or when hidden
  if (state === 'checking' || state === 'hidden') {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-prompt-title"
      aria-describedby="import-prompt-description"
    >
      <div className="w-full max-w-md mx-4 rounded-xl border border-theme-border bg-theme-surface shadow-2xl p-6">
        {state === 'prompt' && (
          <PromptContent onImport={handleImport} onSkip={handleSkip} />
        )}

        {state === 'importing' && <LoadingContent />}

        {state === 'success' && <SuccessContent />}

        {state === 'partial-failure' && importResult && (
          <PartialFailureContent
            result={importResult}
            retryCount={retryCount}
            onRetry={handleRetry}
            onSkip={handleSkip}
          />
        )}

        {state === 'error' && importResult && (
          <ErrorContent
            result={importResult}
            retryCount={retryCount}
            onRetry={handleRetry}
            onSkip={handleSkip}
          />
        )}
      </div>
    </div>
  );
}

// === Sub-components ===

function PromptContent({
  onImport,
  onSkip,
}: {
  onImport: () => void;
  onSkip: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl" aria-hidden="true">📦</span>
        <h2 id="import-prompt-title" className="text-lg font-semibold text-theme-text">
          Import Existing Data
        </h2>
      </div>
      <p id="import-prompt-description" className="text-sm text-theme-text-muted mb-6">
        We found existing data in your browser. Would you like to import your templates
        and tasks into your account? This is a one-time operation.
      </p>
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onSkip}
          className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-accent transition-colors"
          aria-label="Skip import and start fresh"
        >
          Skip
        </button>
        <button
          onClick={onImport}
          className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg bg-theme-accent text-white hover:opacity-90 transition-opacity"
          aria-label="Import data from browser storage"
        >
          Import
        </button>
      </div>
    </>
  );
}

function LoadingContent() {
  return (
    <div className="flex flex-col items-center py-4" role="status" aria-live="polite">
      <div className="w-8 h-8 border-2 border-theme-accent border-t-transparent rounded-full animate-spin mb-4" aria-hidden="true" />
      <p className="text-sm text-theme-text-muted">Importing your data…</p>
    </div>
  );
}

function SuccessContent() {
  return (
    <div className="flex flex-col items-center py-4" role="status" aria-live="polite">
      <span className="text-3xl mb-3" aria-hidden="true">✅</span>
      <p className="text-sm font-medium text-theme-text">Import complete!</p>
      <p className="text-xs text-theme-text-muted mt-1">Your data has been saved to your account.</p>
    </div>
  );
}

function PartialFailureContent({
  result,
  retryCount,
  onRetry,
  onSkip,
}: {
  result: ImportResult;
  retryCount: number;
  onRetry: () => void;
  onSkip: () => void;
}) {
  const canRetry = retryCount < MAX_RETRIES;
  const failedDatasets = result.errors.map((e) => e.dataset);
  const importedDatasets: string[] = [];
  if (result.checklistImported) importedDatasets.push('Checklist');
  if (result.organizerImported) importedDatasets.push('Organizer');

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl" aria-hidden="true">⚠️</span>
        <h2 id="import-prompt-title" className="text-lg font-semibold text-theme-text">
          Partial Import
        </h2>
      </div>
      <div className="text-sm text-theme-text-muted mb-4 space-y-2">
        {importedDatasets.length > 0 && (
          <p className="text-theme-text">
            ✓ Successfully imported: {importedDatasets.join(', ')}
          </p>
        )}
        {result.errors.map((err) => (
          <p key={err.dataset} className="text-amber-600 dark:text-amber-400">
            ✗ Failed to import {err.dataset}: {err.message}
          </p>
        ))}
      </div>
      {!canRetry && (
        <p className="text-xs text-theme-text-faint mb-4">
          Maximum retry attempts reached for: {failedDatasets.join(', ')}.
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onSkip}
          className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-accent transition-colors"
          aria-label="Skip failed datasets and continue"
        >
          Skip
        </button>
        {canRetry && (
          <button
            onClick={onRetry}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg bg-theme-accent text-white hover:opacity-90 transition-opacity"
            aria-label="Retry importing failed datasets"
          >
            Retry
          </button>
        )}
      </div>
    </>
  );
}

function ErrorContent({
  result,
  retryCount,
  onRetry,
  onSkip,
}: {
  result: ImportResult;
  retryCount: number;
  onRetry: () => void;
  onSkip: () => void;
}) {
  const canRetry = retryCount < MAX_RETRIES;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl" aria-hidden="true">❌</span>
        <h2 id="import-prompt-title" className="text-lg font-semibold text-theme-text">
          Import Failed
        </h2>
      </div>
      <div className="text-sm text-theme-text-muted mb-4 space-y-2">
        {result.errors.map((err) => (
          <p key={err.dataset} className="text-red-600 dark:text-red-400">
            {err.message}
          </p>
        ))}
      </div>
      {!canRetry && (
        <p className="text-xs text-theme-text-faint mb-4">
          Maximum retry attempts reached. You can skip and start fresh.
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={onSkip}
          className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg border border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-accent transition-colors"
          aria-label="Skip import and start fresh"
        >
          Skip
        </button>
        {canRetry && (
          <button
            onClick={onRetry}
            className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg bg-theme-accent text-white hover:opacity-90 transition-opacity"
            aria-label="Retry import"
          >
            Retry
          </button>
        )}
      </div>
    </>
  );
}
