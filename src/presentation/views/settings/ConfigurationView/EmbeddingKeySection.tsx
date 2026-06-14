/**
 * Embeddings (Voyage) section of the Configuration page (RAG ladder Rung 2).
 *
 * One self-contained card holding everything Voyage-powered: the per-user
 * embedding-provider key (write-only — the API only reports whether one is set)
 * AND the knowledge / retrieval tuning fields (rendered as a sub-form). The key
 * is optional — when unset, embeddings use the deployment key.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ERRORS } from '@/constants/errors';
import {
  useClearEmbeddingKey,
  useEmbeddingKeyStatus,
  useSetEmbeddingKey,
} from '@/presentation/hooks/embeddings/useEmbeddingKey';
import { KnowledgeSettingsFields } from './KnowledgeSettingsSection';

/** Card for the per-user embedding key plus the knowledge / retrieval tuning. */
export function EmbeddingKeySection() {
  const { data: status, isLoading, isError } = useEmbeddingKeyStatus();
  const setKey = useSetEmbeddingKey();
  const clearKey = useClearEmbeddingKey();
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const hasKey = status?.hasVoyageKey ?? false;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await setKey.mutateAsync(apiKey.trim());
      setApiKey('');
    } catch (err) {
      setError(messageFrom(err, ERRORS.CFG_002.message));
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await clearKey.mutateAsync();
    } catch (err) {
      setError(messageFrom(err, ERRORS.CFG_003.message));
    }
  }

  const statusIndicator = isLoading ? (
    <span className="text-xs text-muted-foreground">Loading…</span>
  ) : isError ? (
    <Badge variant="destructive">Status unavailable</Badge>
  ) : hasKey ? (
    <Badge variant="secondary" data-testid="embedding-key-set">
      Configured
    </Badge>
  ) : (
    <Badge variant="outline" data-testid="embedding-key-unset">
      Not configured
    </Badge>
  );

  return (
    <section
      className="rounded-lg border border-border"
      data-testid="embedding-key-card"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left md:px-6"
        aria-expanded={expanded}
        aria-controls="embedding-key-body"
        data-testid="embedding-key-toggle"
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
        )}
        <span className="min-w-0 flex-1 text-sm font-semibold">
          Embeddings — Voyage
        </span>
        {statusIndicator}
      </button>

      {expanded && (
        <div
          id="embedding-key-body"
          className="flex flex-col gap-4 border-t border-border p-4 md:p-6"
        >
          {isError && (
            <p role="alert" className="text-xs text-destructive">
              {ERRORS.CFG_001.message}
            </p>
          )}

          <p className="text-xs text-muted-foreground">
            Powers semantic search over the Knowledge libraries your agents and
            flows use. Optional — when unset, the deployment key is used if one
            is configured.
          </p>

          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="voyage-key">
                {hasKey ? 'Replace key' : 'API key'}
              </Label>
              <Input
                id="voyage-key"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="pa-…"
                aria-label="Voyage API key"
              />
              <p className="text-xs text-muted-foreground">
                Validated with a live test call before it's saved, then
                encrypted at rest. Never shown again.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              {hasKey && (
                <ConfirmButton
                  size="sm"
                  variant="ghost"
                  confirmTitle="Remove the embedding key?"
                  confirmDescription="Embeddings will fall back to the deployment key. Knowledge search stops working if there is no deployment key configured."
                  confirmLabel="Remove"
                  onConfirm={handleRemove}
                  disabled={clearKey.isPending}
                >
                  Remove
                </ConfirmButton>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={apiKey.trim() === '' || setKey.isPending}
              >
                {setKey.isPending ? 'Saving…' : hasKey ? 'Replace key' : 'Save key'}
              </Button>
            </div>
          </form>

          <KnowledgeSettingsFields />
        </div>
      )}
    </section>
  );
}

/**
 * Extracts a user-facing message from a caught error, preferring the backend
 * `detail` field and falling back to the supplied catalog message.
 */
function messageFrom(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  if (detail) return String(detail);
  return fallback;
}
