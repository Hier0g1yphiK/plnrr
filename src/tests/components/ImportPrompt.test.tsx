/**
 * Component tests for ImportPrompt (src/components/ImportPrompt.tsx)
 * Validates: Requirements 7.1, 7.4, 7.5, 7.6, 7.7, 7.8
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { ImportPrompt } from '@/components/ImportPrompt';
import { ToastProvider } from '@/lib/toast-context';

// Mock the importer module
vi.mock('@/lib/importer', () => ({
  isImportEligible: vi.fn(),
  hasLocalStorageData: vi.fn(),
  runImport: vi.fn(),
}));

// Mock the actions module
vi.mock('@/lib/actions', () => ({
  importUserData: vi.fn(),
}));

import { isImportEligible, hasLocalStorageData, runImport } from '@/lib/importer';
import { importUserData } from '@/lib/actions';

const mockIsImportEligible = vi.mocked(isImportEligible);
const mockHasLocalStorageData = vi.mocked(hasLocalStorageData);
const mockRunImport = vi.mocked(runImport);
const mockImportUserData = vi.mocked(importUserData);

function renderWithProviders() {
  return render(
    <ToastProvider>
      <ImportPrompt />
    </ToastProvider>
  );
}

describe('ImportPrompt Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Eligibility checks', () => {
    it('renders nothing when user is not import-eligible', async () => {
      mockIsImportEligible.mockResolvedValue(false);
      mockHasLocalStorageData.mockReturnValue(true);

      const { container } = renderWithProviders();

      await waitFor(() => {
        expect(container.innerHTML).toBe('');
      });
    });

    it('renders nothing when no localStorage data exists', async () => {
      mockIsImportEligible.mockResolvedValue(true);
      mockHasLocalStorageData.mockReturnValue(false);

      const { container } = renderWithProviders();

      await waitFor(() => {
        expect(container.innerHTML).toBe('');
      });
    });

    it('shows the import prompt when eligible and has data', async () => {
      mockIsImportEligible.mockResolvedValue(true);
      mockHasLocalStorageData.mockReturnValue(true);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });
    });
  });

  describe('Import action', () => {
    beforeEach(() => {
      mockIsImportEligible.mockResolvedValue(true);
      mockHasLocalStorageData.mockReturnValue(true);
    });

    it('shows loading state during import', async () => {
      mockRunImport.mockImplementation(
        () => new Promise(() => {}) // never resolves - stays in loading
      );

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /import data/i }));

      await waitFor(() => {
        expect(screen.getByText('Importing your data…')).toBeInTheDocument();
      });
    });

    it('shows success state on full success', async () => {
      mockRunImport.mockResolvedValue({
        success: true,
        checklistImported: true,
        organizerImported: true,
        errors: [],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /import data/i }));

      await waitFor(() => {
        expect(screen.getByText('Import complete!')).toBeInTheDocument();
      });
    });

    it('shows partial failure with retry option', async () => {
      mockRunImport.mockResolvedValue({
        success: false,
        checklistImported: true,
        organizerImported: false,
        errors: [{ dataset: 'organizer', message: 'Validation failed' }],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /import data/i }));

      await waitFor(() => {
        expect(screen.getByText('Partial Import')).toBeInTheDocument();
        expect(screen.getByText(/Successfully imported: Checklist/)).toBeInTheDocument();
        expect(screen.getByText(/Failed to import organizer/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('shows error state with retry on full failure', async () => {
      mockRunImport.mockResolvedValue({
        success: false,
        checklistImported: false,
        organizerImported: false,
        errors: [{ dataset: 'checklist', message: 'Server write failed' }],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /import data/i }));

      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('hides retry button after 3 failed attempts', async () => {
      mockRunImport.mockResolvedValue({
        success: false,
        checklistImported: false,
        organizerImported: false,
        errors: [{ dataset: 'checklist', message: 'Server write failed' }],
      });

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      // First attempt (retryCount goes to 1)
      fireEvent.click(screen.getByRole('button', { name: /import data/i }));
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      });

      // Second attempt (retryCount goes to 2)
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
      });

      // Third attempt (retryCount goes to 3 — max reached)
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Maximum retry attempts reached/)).toBeInTheDocument();
      });
    });
  });

  describe('Skip action', () => {
    beforeEach(() => {
      mockIsImportEligible.mockResolvedValue(true);
      mockHasLocalStorageData.mockReturnValue(true);
      mockImportUserData.mockResolvedValue({});
    });

    it('calls importUserData with empty defaults on skip to persist flag', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /skip/i }));

      await waitFor(() => {
        expect(mockImportUserData).toHaveBeenCalledWith(
          { version: 1, templates: [], activeChecklist: null },
          { version: 1, tasks: [] }
        );
      });
    });

    it('hides the prompt after skip', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText('Import Existing Data')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /skip/i }));

      await waitFor(() => {
        expect(screen.queryByText('Import Existing Data')).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockIsImportEligible.mockResolvedValue(true);
      mockHasLocalStorageData.mockReturnValue(true);
    });

    it('has proper dialog role and aria attributes', async () => {
      renderWithProviders();

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
        expect(dialog).toHaveAttribute('aria-labelledby', 'import-prompt-title');
        expect(dialog).toHaveAttribute('aria-describedby', 'import-prompt-description');
      });
    });

    it('buttons have accessible labels', async () => {
      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /skip import/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /import data/i })).toBeInTheDocument();
      });
    });
  });
});
