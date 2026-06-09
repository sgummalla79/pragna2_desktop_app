/**
 * Documents manager for a single knowledge library (RAG ladder Rung 2).
 *
 * Lists a library's documents and lets you add one (paste text OR upload a
 * file) and delete them. Rendered inside an expanded library card on the
 * Knowledge settings page.
 */

import { useState } from 'react';
import { FileText, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ERRORS } from '@/constants/errors';
import { slugify } from '@/domain/utils/slugify';
import {
  useDeleteSource,
  useIngestSource,
  useLibrarySources,
  useUploadSource,
} from '@/presentation/hooks/knowledge/useKnowledgeLibraries';

/** File types the BE can turn into a knowledge source (mirrors the backend's
 *  KNOWLEDGE_INGESTIBLE_MIME_TYPES). The BE is the real gate (415) — this is a
 *  native file-picker hint only. */
const KNOWLEDGE_FILE_ACCEPT = '.pdf,.txt,.md,.markdown,.csv,.docx,.xlsx';

/** Lists and manages the documents inside a single knowledge library. */
export function LibraryDocumentsManager({ libraryId }: { libraryId: string }) {
  const { data: sources = [], isLoading, isError } =
    useLibrarySources(libraryId);
  const del = useDeleteSource(libraryId);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete(sourceId: string) {
    setDeleteError(null);
    try {
      await del.mutateAsync(sourceId);
    } catch (err) {
      setDeleteError(messageFrom(err, ERRORS.KNW_007.message));
      throw err;
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="library-documents">
      <div>
        <Label className="text-sm font-semibold">
          Documents
          {sources.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({sources.length})
            </span>
          )}
        </Label>
        {isLoading ? (
          <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            Loading documents…
          </p>
        ) : isError ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {ERRORS.KNW_004.message}
          </p>
        ) : sources.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No documents yet. Add one below.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FileText size={16} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {s.displayName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    <span className="font-mono">{s.slug}</span> · ~
                    {s.tokenCount} tokens
                  </span>
                </span>
                <ConfirmButton
                  size="icon"
                  variant="ghost"
                  confirmTitle={`Delete '${s.displayName}'?`}
                  confirmDescription="The document and its embeddings are removed from this library."
                  confirmLabel="Delete"
                  onConfirm={() => handleDelete(s.id)}
                  aria-label={`Delete ${s.displayName}`}
                  title="Delete document"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
        {deleteError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {deleteError}
          </p>
        )}
      </div>

      <AddDocumentForm libraryId={libraryId} />
    </div>
  );
}

type AddMode = 'text' | 'file';

/** The inline "add a document" form (paste text OR upload a file). */
function AddDocumentForm({ libraryId }: { libraryId: string }) {
  const ingest = useIngestSource(libraryId);
  const upload = useUploadSource(libraryId);
  const [mode, setMode] = useState<AddMode>('text');
  const [slug, setSlug] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [summary, setSummary] = useState('');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = ingest.isPending || upload.isPending;
  const bodyReady = mode === 'text' ? text.trim() !== '' : file !== null;
  const canSubmit =
    slug.trim() !== '' && displayName.trim() !== '' && bodyReady;

  function reset() {
    setSlug('');
    setDisplayName('');
    setSummary('');
    setText('');
    setFile(null);
  }

  /** When a file is chosen, pre-fill slug + title from its name (still
   *  editable) so the common case is one click + Add. */
  function handleFilePick(picked: File | null) {
    setFile(picked);
    if (!picked) return;
    const base = picked.name.replace(/\.[^.]+$/, '');
    if (slug.trim() === '') setSlug(slugify(base));
    if (displayName.trim() === '') setDisplayName(base);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || pending) return;
    setError(null);
    try {
      const meta = {
        slug: slug.trim(),
        displayName: displayName.trim(),
        summary: summary.trim() || undefined,
      };
      if (mode === 'file' && file) {
        await upload.mutateAsync({ ...meta, file });
      } else {
        await ingest.mutateAsync({ ...meta, text });
      }
      reset();
    } catch (err) {
      const fallback =
        mode === 'file' ? ERRORS.KNW_006.message : ERRORS.KNW_005.message;
      setError(messageFrom(err, fallback));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3"
      data-testid="knowledge-add-document"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs">Add a document</Label>
        <div
          className="flex rounded-md border border-border p-0.5"
          role="tablist"
        >
          {(['text', 'file'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={
                'rounded px-2 py-0.5 text-xs font-medium ' +
                (mode === m
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground')
              }
              data-testid={`knowledge-add-mode-${m}`}
            >
              {m === 'text' ? 'Paste text' : 'Upload file'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="Reference ID (kebab-case)"
          aria-label="Document reference ID"
        />
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Title"
          aria-label="Document title"
        />
      </div>
      <Input
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="One-line summary (optional)"
        aria-label="Document summary"
      />

      {mode === 'text' ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the document text…"
          rows={5}
          aria-label="Document text"
        />
      ) : (
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilePick(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <Upload size={22} aria-hidden="true" className="shrink-0" />
          <span className="min-w-0 max-w-full truncate font-medium text-foreground">
            {file ? file.name : 'Choose a file or drag it here'}
          </span>
          <span className="text-xs text-muted-foreground">
            PDF, text, Markdown, CSV, docx, xlsx
          </span>
          <input
            type="file"
            className="sr-only"
            accept={KNOWLEDGE_FILE_ACCEPT}
            aria-label="Document file"
            onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
          />
        </label>
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button type="submit" size="sm" disabled={!canSubmit || pending}>
          {pending ? 'Adding…' : 'Add document'}
        </Button>
      </div>
    </form>
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
