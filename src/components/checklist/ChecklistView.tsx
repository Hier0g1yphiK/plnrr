'use client';

import { useState, useRef, useEffect } from 'react';
import { useChecklist } from '@/lib/checklist-context';
import { InlineError } from '@/components/InlineError';
import { TemplateList } from './TemplateList';
import { TemplateEditor } from './TemplateEditor';
import { ActiveChecklist } from './ActiveChecklist';

type SubView =
  | { kind: 'list' }
  | { kind: 'creating' }
  | { kind: 'editor'; templateId: string }
  | { kind: 'active' };

export function ChecklistView() {
  const { state, dispatch } = useChecklist();
  const [subView, setSubView] = useState<SubView>({ kind: 'list' });
  const [newTemplateName, setNewTemplateName] = useState('');
  const [createError, setCreateError] = useState('');
  const [lastSelectedTemplateId, setLastSelectedTemplateId] = useState<string | null>(null);

  // Refs for focus management
  const activeChecklistRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus management on sub-view transitions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (subView.kind === 'active' && activeChecklistRef.current) {
        // Focus the first checkbox in the active checklist
        const firstCheckbox = activeChecklistRef.current.querySelector<HTMLInputElement>(
          'input[type="checkbox"]'
        );
        if (firstCheckbox) {
          firstCheckbox.focus();
        } else {
          activeChecklistRef.current.focus();
        }
      } else if (subView.kind === 'editor' && editorRef.current) {
        editorRef.current.focus();
      } else if (subView.kind === 'list' && listRef.current) {
        // If returning from active/editor, try to focus the template that was selected
        if (lastSelectedTemplateId) {
          const templateButton = listRef.current.querySelector<HTMLElement>(
            `[data-template-id="${lastSelectedTemplateId}"]`
          );
          if (templateButton) {
            templateButton.focus();
            return;
          }
        }
        // Fallback: focus the list container
        listRef.current.focus();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [subView, lastSelectedTemplateId]);

  // When a template is selected from the list, load it as the active checklist
  const handleSelectTemplate = (templateId: string) => {
    setLastSelectedTemplateId(templateId);
    dispatch({ type: 'LOAD_TEMPLATE', payload: { templateId } });
    setSubView({ kind: 'active' });
  };

  // Show inline create form
  const handleCreateTemplate = () => {
    setNewTemplateName('');
    setCreateError('');
    setSubView({ kind: 'creating' });
  };

  // Submit the new template name
  const handleSubmitCreate = () => {
    const trimmed = newTemplateName.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      setCreateError('Template name must be 1–100 characters.');
      return;
    }
    // Check for duplicate name
    const duplicate = state.templates.some(
      (t) => t.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setCreateError('A template with this name already exists.');
      return;
    }

    dispatch({ type: 'CREATE_TEMPLATE', payload: { name: trimmed } });

    // Navigate to editor for the new template (it's the last one added)
    // Since dispatch is synchronous in useReducer, state.templates won't have updated yet.
    // Navigate to list and the user can then edit or select it.
    // Actually, we can find the ID by matching name after state update on next render.
    // Simpler: just go back to the list.
    setNewTemplateName('');
    setCreateError('');
    setSubView({ kind: 'list' });
  };

  // Navigate to editor for an existing template
  const handleEditTemplate = (templateId: string) => {
    setLastSelectedTemplateId(templateId);
    setSubView({ kind: 'editor', templateId });
  };

  // Navigate back to template list
  const handleBackToList = () => {
    setSubView({ kind: 'list' });
  };

  // Render sub-view based on state machine
  switch (subView.kind) {
    case 'creating':
      return (
        <div className="space-y-4">
          <button
            onClick={handleBackToList}
            className="min-w-[44px] min-h-[44px] flex items-center gap-2 text-sm font-body text-theme-text-muted hover:text-theme-accent transition-colors"
            aria-label="Back to template list"
          >
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </button>

          <div className="rounded-xl border border-theme-border bg-theme-surface p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-theme-text">
              New Template
            </h2>
            <div className="space-y-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => {
                  setNewTemplateName(e.target.value);
                  if (createError) setCreateError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmitCreate();
                  if (e.key === 'Escape') handleBackToList();
                }}
                placeholder="Template name"
                maxLength={100}
                autoFocus
                className="w-full min-h-[44px] px-4 rounded-lg bg-theme-surface-alt border border-theme-border text-theme-text placeholder-theme-text-faint font-body text-sm focus:outline-none focus:ring-2 focus:ring-theme-accent"
                aria-label="Template name"
              />
              <InlineError message={createError} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSubmitCreate}
                className="min-w-[44px] min-h-[44px] px-6 py-2 rounded-lg bg-theme-accent hover:bg-theme-accent-hover text-theme-accent-text font-body font-semibold text-sm transition-colors"
              >
                Create
              </button>
              <button
                onClick={handleBackToList}
                className="min-w-[44px] min-h-[44px] px-6 py-2 rounded-lg border border-theme-border text-theme-text-muted font-body text-sm hover:bg-theme-surface-alt transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );

    case 'editor':
      return (
        <div ref={editorRef} tabIndex={-1} className="outline-none">
          <TemplateEditor
            templateId={subView.templateId}
            onBack={handleBackToList}
          />
        </div>
      );

    case 'active':
      return (
        <div className="space-y-4 outline-none" ref={activeChecklistRef} tabIndex={-1}>
          {/* Back button to return to template list */}
          <button
            onClick={handleBackToList}
            className="min-w-[44px] min-h-[44px] flex items-center gap-2 text-sm font-body text-theme-text-muted hover:text-theme-accent transition-colors"
            aria-label="Back to template list"
          >
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
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Templates
          </button>

          <ActiveChecklist />

          {/* If active checklist has a source template, offer to edit it */}
          {state.activeChecklist && (
            <button
              onClick={() =>
                handleEditTemplate(state.activeChecklist!.templateId)
              }
              className="min-w-[44px] min-h-[44px] w-full px-4 py-2 rounded-lg border border-theme-border text-sm font-body text-theme-text-muted hover:bg-theme-surface-alt transition-colors"
              aria-label="Edit source template"
            >
              Edit Template
            </button>
          )}
        </div>
      );

    case 'list':
    default:
      return (
        <div className="space-y-4 outline-none" ref={listRef} tabIndex={-1}>
          <TemplateList
            onSelectTemplate={handleSelectTemplate}
            onCreateTemplate={handleCreateTemplate}
            onEditTemplate={handleEditTemplate}
          />

          {/* If there's already an active checklist, show a link to resume it */}
          {state.activeChecklist && (
            <button
              onClick={() => setSubView({ kind: 'active' })}
              className="min-w-[44px] min-h-[44px] w-full px-4 py-3 rounded-lg bg-mint-50 dark:bg-mint-950/20 border border-mint-200 dark:border-mint-800 text-sm font-body font-semibold text-mint-700 dark:text-mint-300 hover:bg-mint-100 dark:hover:bg-mint-900/30 transition-colors"
              aria-label="Resume active checklist"
            >
              Resume Active Checklist
            </button>
          )}
        </div>
      );
  }
}
