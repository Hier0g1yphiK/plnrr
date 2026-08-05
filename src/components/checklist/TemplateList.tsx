'use client';

import { useState } from 'react';
import { useChecklist } from '@/lib/checklist-context';
import type { Template } from '@/lib/types';

interface TemplateListProps {
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: () => void;
  onEditTemplate?: (templateId: string) => void;
}

function TrashIcon() {
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function TemplateCard({
  template,
  onSelect,
  onDelete,
  onEdit,
}: {
  template: Template;
  onSelect: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmingDelete) {
      onDelete();
      setConfirmingDelete(false);
    } else {
      setConfirmingDelete(true);
    }
  };

  const handleBlurDelete = () => {
    setConfirmingDelete(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      data-template-id={template.id}
      className="group flex items-center justify-between rounded-lg border border-zinc-200 dark:border-lavender-800 bg-white dark:bg-lavender-950/50 p-4 cursor-pointer transition-colors hover:border-lavender-400 dark:hover:border-lavender-500 hover:bg-lavender-50 dark:hover:bg-lavender-900/30"
      aria-label={`Template: ${template.name}, ${template.items.length} items`}
    >
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-body font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {template.name}
        </span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400 font-body">
          {template.items.length} {template.items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {onEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-lavender-500 dark:hover:text-lavender-400 transition-all"
            aria-label={`Edit ${template.name}`}
            title="Edit template"
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
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
        <button
          onClick={handleDelete}
          onBlur={handleBlurDelete}
          className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-colors ${
            confirmingDelete
              ? 'text-pink-500 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30'
              : 'text-zinc-400 dark:text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-pink-500 dark:hover:text-pink-400'
          }`}
          aria-label={confirmingDelete ? `Confirm delete ${template.name}` : `Delete ${template.name}`}
          title={confirmingDelete ? 'Click again to confirm' : 'Delete template'}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

export function TemplateList({ onSelectTemplate, onCreateTemplate, onEditTemplate }: TemplateListProps) {
  const { state, dispatch } = useChecklist();
  const { templates } = state;

  const handleDelete = (templateId: string) => {
    dispatch({ type: 'DELETE_TEMPLATE', payload: { templateId } });
  };

  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="mb-4 text-5xl" aria-hidden="true">
          📋
        </div>
        <h2 className="font-display text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-2">
          No templates yet
        </h2>
        <p className="font-body text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">
          Create your first checklist template to start tracking your pre-stream routine.
        </p>
        <button
          onClick={onCreateTemplate}
          className="min-w-[44px] min-h-[44px] px-6 py-3 rounded-lg bg-lavender-500 hover:bg-lavender-600 text-white font-body font-semibold transition-colors"
          aria-label="Create your first template"
        >
          Create Template
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-display text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          Templates
        </h2>
        <button
          onClick={onCreateTemplate}
          className="min-w-[44px] min-h-[44px] px-4 py-2 rounded-lg bg-lavender-500 hover:bg-lavender-600 text-white text-sm font-body font-semibold transition-colors"
          aria-label="Create new template"
        >
          + New
        </button>
      </div>

      <div className="flex flex-col gap-2" role="list" aria-label="Checklist templates">
        {templates.map((template) => (
          <div key={template.id} role="listitem">
            <TemplateCard
              template={template}
              onSelect={() => onSelectTemplate(template.id)}
              onDelete={() => handleDelete(template.id)}
              onEdit={onEditTemplate ? () => onEditTemplate(template.id) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
