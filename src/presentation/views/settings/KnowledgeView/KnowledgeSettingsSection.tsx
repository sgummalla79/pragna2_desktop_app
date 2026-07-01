/**
 * Knowledge / retrieval settings fields (RAG Rung 2).
 *
 * A body-only sub-form rendered INSIDE the "Embeddings — Voyage" card (it shares
 * that accordion rather than owning its own). It keeps its own data hook, dirty
 * state, and Save/Reset because it PATCHes a different endpoint than the key.
 *
 * Fields are grouped by the three backend behavioural classes:
 *
 * - **Embedding model** (read-only) — the locked provider/dimensions pins plus
 *   the model new libraries pin. Not editable here (the vector column + the
 *   single provider are fixed; model has one allowlisted value today).
 * - **Chunking** — applies to libraries/documents created *after* a change.
 * - **Search & rerank** — takes effect on the next search / read.
 *
 * Saving PATCHes the editable fields (the backend bounds-checks and returns a
 * 422 with a message on an out-of-range value).
 */

import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useKnowledgeSettings,
  useUpdateKnowledgeSettings,
} from '@/presentation/hooks/knowledge/useKnowledgeSettings';
import type {
  EditableKnowledgeSettings,
  KnowledgeSettings,
} from '@/domain/types/knowledgeSettings.types';

function toEditable(s: KnowledgeSettings): EditableKnowledgeSettings {
  // Explicitly pick the editable fields (drop the locked provider/dimensions).
  return {
    embeddingModel: s.embeddingModel,
    chunkMaxTokens: s.chunkMaxTokens,
    chunkOverlapTokens: s.chunkOverlapTokens,
    rerankEnabled: s.rerankEnabled,
    rerankModel: s.rerankModel,
    searchDenseK: s.searchDenseK,
    searchSparseK: s.searchSparseK,
    rrfK: s.rrfK,
    rerankCandidates: s.rerankCandidates,
    searchTopK: s.searchTopK,
    cagMaxSourceTokens: s.cagMaxSourceTokens,
  };
}

export function KnowledgeSettingsFields() {
  const { data, isLoading, isError } = useKnowledgeSettings();
  const update = useUpdateKnowledgeSettings();
  const [form, setForm] = useState<EditableKnowledgeSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setForm(toEditable(data));
  }, [data]);

  const dirty =
    !!form && !!data && JSON.stringify(form) !== JSON.stringify(toEditable(data));

  function set<K extends keyof EditableKnowledgeSettings>(
    key: K,
    value: EditableKnowledgeSettings[K],
  ) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    try {
      await update.mutateAsync(form);
    } catch (err) {
      setError(messageFrom(err, 'Failed to save the settings.'));
    }
  }

  function handleReset() {
    if (data) setForm(toEditable(data));
    setError(null);
  }

  return (
    <div
      className="flex flex-col gap-4 border-t border-border pt-4"
      data-testid="knowledge-settings-fields"
    >
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-sm font-semibold">
          Knowledge &amp; retrieval
        </h3>
        {dirty && (
          <Badge variant="outline" data-testid="knowledge-settings-dirty">
            Unsaved changes
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Tunes how your agents embed and search the Knowledge libraries they use.
        Defaults work well — change these only if you know why.
      </p>

      {!form || !data ? (
        <p className="text-xs text-muted-foreground">
          {isError ? 'Could not load settings.' : isLoading ? 'Loading…' : null}
        </p>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <Group title="Embedding model" note="Fixed by the deployment.">
            <ReadOnlyField label="Provider" value={data.embeddingProvider} />
            <ReadOnlyField
              label="Model (new libraries)"
              value={data.embeddingModel}
            />
            <ReadOnlyField
              label="Dimensions"
              value={String(data.embeddingDimensions)}
            />
          </Group>

          <Group
            title="Chunking"
            note="Applies to documents ingested after you save — existing chunks are unchanged."
          >
            <NumberField
              id="chunk-max-tokens"
              label="Max tokens per chunk"
              value={form.chunkMaxTokens}
              onChange={(v) => set('chunkMaxTokens', v)}
            />
            <NumberField
              id="chunk-overlap-tokens"
              label="Chunk overlap (tokens)"
              value={form.chunkOverlapTokens}
              onChange={(v) => set('chunkOverlapTokens', v)}
            />
          </Group>

          <Group
            title="Search &amp; rerank"
            note="Takes effect on the next search."
          >
            <label className="col-span-full flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.rerankEnabled}
                onChange={(e) => set('rerankEnabled', e.target.checked)}
                data-testid="rerank-enabled"
                className="h-4 w-4 rounded border-border"
              />
              Re-rank results after fusion
            </label>
            <TextField
              id="rerank-model"
              label="Rerank model"
              value={form.rerankModel}
              onChange={(v) => set('rerankModel', v)}
            />
            <NumberField
              id="search-top-k"
              label="Results returned (top k)"
              value={form.searchTopK}
              onChange={(v) => set('searchTopK', v)}
            />
            <NumberField
              id="search-dense-k"
              label="Dense candidates"
              value={form.searchDenseK}
              onChange={(v) => set('searchDenseK', v)}
            />
            <NumberField
              id="search-sparse-k"
              label="Sparse candidates"
              value={form.searchSparseK}
              onChange={(v) => set('searchSparseK', v)}
            />
            <NumberField
              id="rerank-candidates"
              label="Rerank candidates"
              value={form.rerankCandidates}
              onChange={(v) => set('rerankCandidates', v)}
            />
            <NumberField
              id="rrf-k"
              label="RRF constant (k)"
              value={form.rrfK}
              onChange={(v) => set('rrfK', v)}
            />
            <NumberField
              id="cag-max-source-tokens"
              label="Max tokens read whole (CAG)"
              value={form.cagMaxSourceTokens}
              onChange={(v) => set('cagMaxSourceTokens', v)}
            />
          </Group>

          {error && (
            <p role="alert" className="text-[12px] text-destructive">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={!dirty || update.isPending}
            >
              Reset
            </Button>
            <Button type="submit" size="sm" disabled={!dirty || update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <div>
        <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </legend>
        {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function NumberField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      />
    </div>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

function messageFrom(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  if (detail) return String(detail);
  return err instanceof Error ? err.message : fallback;
}
