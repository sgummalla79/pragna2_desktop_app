/**
 * Knowledge settings page (RAG ladder Rung 2).
 *
 * Libraries are reusable corpora — define one here, add documents, then
 * (elsewhere) reference it from agents and flows. A library pins its embedding
 * model at creation. Deleting a library cascades: it removes the library and
 * all of its documents.
 */

import { useState } from 'react';
import { AlertTriangle, Library, Plus } from 'lucide-react';

import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ERRORS } from '@/constants/errors';
import { useEmbeddingKeyStatus } from '@/presentation/hooks/embeddings/useEmbeddingKey';
import {
  useCreateLibrary,
  useKnowledgeLibraries,
} from '@/presentation/hooks/knowledge/useKnowledgeLibraries';
import { EmbeddingKeySection } from './EmbeddingKeySection';
import { KnowledgeLibraryCard } from './KnowledgeLibraryCard';

/** Knowledge settings page — lists, creates, and manages knowledge libraries. */
export default function KnowledgeView() {
  const { data: libraries = [], isLoading, isError } = useKnowledgeLibraries();
  const { data: keyStatus } = useEmbeddingKeyStatus();
  const hasVoyageKey = keyStatus?.hasVoyageKey ?? false;
  const [creating, setCreating] = useState(false);

  // System-managed corpora (e.g. the seeded "Nexus Kit Documentation") are not
  // user-owned: they never appear in this management list and cannot be
  // edited/deleted here. They remain attachable to agents and flows elsewhere.
  const userLibraries = libraries.filter((l) => !l.isSystem);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <EntityIcon entity="knowledge" size="lg" />
            Knowledge
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Reusable document libraries your agents and flows can search (RAG).
            Define them here, then attach where needed.
          </p>
        </div>
        <Button
          onClick={() => setCreating((v) => !v)}
          size="sm"
          className="shrink-0"
          disabled={!hasVoyageKey}
          title={!hasVoyageKey ? 'A Voyage API key is required to create knowledge libraries.' : undefined}
        >
          <Plus size={16} aria-hidden="true" />
          New library
        </Button>
      </div>

      <div className="mb-6">
        <EmbeddingKeySection />
      </div>

      {!hasVoyageKey && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p>
            A Voyage API key is required to use Knowledge / RAG features. Configure
            it in the <span className="font-medium">Embeddings — Voyage</span> section
            above, then add libraries and documents below.
          </p>
        </div>
      )}

      {creating && hasVoyageKey && <CreateLibraryForm onDone={() => setCreating(false)} />}

      {isLoading ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Loading libraries…
        </p>
      ) : isError ? (
        <p role="alert" className="text-sm text-destructive">
          {ERRORS.KNW_001.message}
        </p>
      ) : userLibraries.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground">
          <Library
            size={40}
            className="mx-auto mb-3 opacity-30"
            aria-hidden="true"
          />
          <p>
            No knowledge libraries yet. Create one, add documents, then attach it
            to an agent or a flow.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {userLibraries.map((l) => (
            <KnowledgeLibraryCard key={l.id} library={l} hasVoyageKey={hasVoyageKey} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Inline form for creating a new library (name + reference id + description). */
function CreateLibraryForm({ onDone }: { onDone: () => void }) {
  const create = useCreateLibrary();
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = slug.trim() !== '' && name.trim() !== '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        slug: slug.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onDone();
    } catch (err) {
      setError(messageFrom(err, ERRORS.KNW_002.message));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 flex flex-col gap-3 rounded-lg border border-border p-4"
      data-testid="knowledge-create-form"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="kb-name">Name</Label>
          <Input
            id="kb-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Knowledge Docs"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="kb-slug">Reference ID</Label>
          <Input
            id="kb-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="knowledge-docs"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="kb-description">Description (optional)</Label>
        <Textarea
          id="kb-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this corpus contains."
          rows={2}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit || create.isPending}
        >
          {create.isPending ? 'Creating…' : 'Create library'}
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
