/**
 * One expandable knowledge-library card (RAG Rung 2).
 *
 * Collapsed: name + reference id + pinned embedding model + a Delete action.
 * Expanded: the library's documents (add via paste / file upload, delete).
 *
 * Deleting a library here **cascades**: the library and all of its documents
 * are removed.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Badge } from '@/components/ui/badge';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { ERRORS } from '@/constants/errors';
import { LibraryDocumentsManager } from '@/presentation/components/knowledge/LibraryDocumentsManager';
import { useArchiveLibrary } from '@/presentation/hooks/knowledge/useKnowledgeLibraries';
import type { KnowledgeLibrary } from '@/domain/types/knowledge.types';

interface Props {
  library: KnowledgeLibrary;
  /** Whether the user has a Voyage key configured. When false the add-document
   *  form is hidden and a contextual note is shown instead. */
  hasVoyageKey: boolean;
}

/** Renders a single knowledge library as an expandable card. */
export function KnowledgeLibraryCard({ library, hasVoyageKey }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const del = useArchiveLibrary();

  async function handleArchive() {
    setError(null);
    try {
      await del.mutateAsync(library.id);
    } catch (err) {
      setError(messageFrom(err, ERRORS.KNW_003.message));
      throw err;
    }
  }

  return (
    <div
      className="rounded-lg border border-border"
      data-testid="knowledge-library-card"
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-controls={`knowledge-body-${library.id}`}
        >
          {expanded ? (
            <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
          )}
          <EntityIcon entity="knowledge" size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {library.name}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {library.slug}
            </span>
          </span>
        </button>
        <Badge
          variant="secondary"
          title="Embedding model (pinned)"
          className="shrink-0"
        >
          {library.embeddingModel}
        </Badge>
        <ConfirmButton
          size="icon"
          variant="ghost"
          aria-label={`Delete ${library.name}`}
          title="Delete library"
          confirmTitle={`Delete '${library.name}'?`}
          confirmDescription="Permanently deletes the library and all its documents. This can't be undone."
          confirmLabel="Delete"
          onConfirm={handleArchive}
        >
          <Trash2 size={15} aria-hidden="true" />
        </ConfirmButton>
      </div>

      {error && (
        <p role="alert" className="px-4 pb-3 text-xs text-destructive">
          {error}
        </p>
      )}

      {expanded && (
        <div
          id={`knowledge-body-${library.id}`}
          className="border-t border-border px-4 py-3"
        >
          <LibraryDocumentsManager libraryId={library.id} hasVoyageKey={hasVoyageKey} />
        </div>
      )}
    </div>
  );
}

/**
 * Extracts a user-facing message from an unknown error, preferring the backend
 * `detail` field and falling back to a catalog message.
 */
function messageFrom(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  if (detail) return String(detail);
  return fallback;
}
