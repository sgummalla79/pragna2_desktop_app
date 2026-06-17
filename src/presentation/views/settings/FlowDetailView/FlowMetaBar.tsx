/**
 * The flow editor's top control bar.
 *
 * Two concerns sit here, with DIFFERENT persistence models — kept visually
 * grouped so the distinction is legible:
 *
 *  - **Graph meta** (Description, Expose-as-/slash, Slash name): edits the
 *    Zustand store's `meta`; persisted with the canvas on **Save** (the YAML
 *    round-trip). The backend rejects slash-exposure without a description, so
 *    an inline hint nudges the user before they Save.
 *  - **Enabled** (load / unload from the runtime): a flow-level field OUTSIDE
 *    the YAML graph, so it's an **immediate** PATCH (`useUpdateFlow`), not
 *    Save-gated — mirroring the slash-toggle on the flow-list card.
 *
 * YAML import/export live in {@link FlowYamlActions}; Save (validate + persist)
 * stays with the parent {@link FlowEditor}, surfaced here via `onSave`.
 */

import { useState } from 'react';
import { Save } from 'lucide-react';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ERRORS } from '@/constants/errors';
import { FLOW_SLASH_NAME_RE } from '@/constants/flows';
import { logger } from '@/infrastructure/logging/logger';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { useUpdateFlow } from '@/presentation/hooks/flows/useFlows';
import type { Flow } from '@/domain/types/flow.types';

import { FlowYamlActions } from './FlowYamlActions';
import { useFlowEditorStore } from './useFlowEditorStore';

interface Props {
  flow: Flow;
  /** Whether the canvas/meta has unsaved edits. */
  dirty: boolean;
  /** A validate-or-save call is in flight. */
  isSaving: boolean;
  /** Run the parent's validate + persist. */
  onSave: () => void;
}

/** Editor toolbar: graph-meta fields + enabled toggle + YAML actions + Save. */
export function FlowMetaBar({ flow, dirty, isSaving, onSave }: Props) {
  const meta = useFlowEditorStore((s) => s.meta);
  const setMeta = useFlowEditorStore((s) => s.setMeta);
  const updateFlow = useUpdateFlow();
  const [enabledError, setEnabledError] = useState<string | null>(null);

  const descriptionMissing = meta.exposedAsSlash && !(meta.description ?? '').trim();
  const slashNameInvalid =
    meta.exposedAsSlash &&
    !!(meta.slashApiName ?? '').trim() &&
    !FLOW_SLASH_NAME_RE.test((meta.slashApiName ?? '').trim());

  async function toggleEnabled() {
    setEnabledError(null);
    try {
      await updateFlow.mutateAsync({
        flowId: flow.id,
        payload: { enabled: !flow.enabled },
      });
    } catch (err) {
      const detail =
        axios.isAxiosError(err) && typeof err.response?.data?.detail === 'string'
          ? err.response.data.detail
          : ERRORS.FLW_009.message;
      setEnabledError(detail);
      logger.fromError('FLW_009:enabled', err instanceof Error ? err : new Error(String(err)));
    }
  }

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      {/* Flow identity — icon + name + api_name / slash pills, above the meta. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <EntityIcon entity="flows" />
        <span className="text-sm font-semibold text-foreground">{flow.displayName}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {flow.apiName}
        </span>
        {flow.exposedAsSlash && flow.slashApiName && (
          <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-[11px] text-accent-foreground">
            /{flow.slashApiName}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* ── Graph meta (Save-gated) ── No visible label; the placeholder
            carries the intent and an aria-label keeps it accessible. The input
            is a direct flex child so its box edge is flush with the identity
            row's flow icon above (both at the container's left padding). */}
        <Input
          id="flow-description"
          aria-label="Description"
          className="h-8 min-w-[14rem] flex-1 text-sm"
          value={meta.description ?? ''}
          onChange={(e) => setMeta({ description: e.target.value || null })}
          placeholder="Describe what this flow does — the LLM reads this to decide when to invoke it"
        />

        <label className="flex h-8 shrink-0 select-none items-center gap-1.5 self-end text-sm text-foreground">
          <input
            type="checkbox"
            checked={meta.exposedAsSlash}
            onChange={(e) => setMeta({ exposedAsSlash: e.target.checked })}
          />
          Expose as /slash
        </label>

        {meta.exposedAsSlash && (
          <div className="flex flex-col gap-0.5">
            <label
              htmlFor="flow-slash-name"
              className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Slash name
            </label>
            <Input
              id="flow-slash-name"
              className="h-8 w-44 font-mono text-sm"
              value={meta.slashApiName ?? ''}
              onChange={(e) => setMeta({ slashApiName: e.target.value || null })}
              placeholder="my-flow"
              aria-invalid={slashNameInvalid}
            />
          </div>
        )}

        {/* ── Actions (right cluster) ── */}
        <div className="ml-auto flex shrink-0 items-center gap-2 self-end">
          {/* Enabled — immediate PATCH, not Save-gated. Fixed min-width +
              centered label so toggling "Enabled" ⇄ "Disabled" (different text
              lengths) doesn't shift the adjacent controls. */}
          <Button
            type="button"
            variant={flow.enabled ? 'default' : 'outline'}
            size="xs"
            className="min-w-[5rem] justify-center"
            onClick={() => void toggleEnabled()}
            disabled={updateFlow.isPending}
            title={flow.enabled ? 'Disable (unload from the runtime)' : 'Enable (load into the runtime)'}
          >
            {flow.enabled ? 'Enabled' : 'Disabled'}
          </Button>

          <FlowYamlActions apiName={flow.apiName} />

          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white',
              dirty ? 'bg-amber-600' : 'bg-emerald-600',
            )}
          >
            {dirty ? 'Unsaved' : 'Saved'}
          </span>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || !dirty}
            aria-busy={isSaving}
          >
            <Save size={14} aria-hidden="true" />
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Inline hints — only render when something needs attention. */}
      {(descriptionMissing || slashNameInvalid || enabledError) && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {descriptionMissing && (
            <p className="text-[11px] text-amber-600">
              Add a description before exposing — the LLM uses it as the tool description.
            </p>
          )}
          {slashNameInvalid && (
            <p className="text-[11px] text-amber-600">{ERRORS.FLW_008.message}</p>
          )}
          {enabledError && <p className="text-[11px] text-destructive">{enabledError}</p>}
        </div>
      )}
    </div>
  );
}
