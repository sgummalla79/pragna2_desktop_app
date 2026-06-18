/**
 * The flow editor's top control bar.
 *
 * Handles graph-meta fields (Description, Expose-as-/slash, Slash name) that
 * are Save-gated (persisted via the YAML round-trip). YAML import/export/view
 * live in {@link FlowYamlActions}. Save/Cancel live in the parent
 * {@link FlowEditor} footer. Enabled/Disabled is on the flow card on the main
 * flows list — not duplicated here.
 */

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ERRORS } from '@/constants/errors';
import { FLOW_SLASH_NAME_RE } from '@/constants/flows';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import type { Flow } from '@/domain/types/flow.types';

import { FlowYamlActions } from './FlowYamlActions';
import { useFlowEditorStore } from './useFlowEditorStore';

interface Props {
  flow: Flow;
  /** Whether the canvas/meta has unsaved edits. */
  dirty: boolean;
}

/** Editor toolbar: flow identity + graph-meta fields + YAML actions. */
export function FlowMetaBar({ flow, dirty }: Props) {
  const meta = useFlowEditorStore((s) => s.meta);
  const setMeta = useFlowEditorStore((s) => s.setMeta);

  const descriptionMissing = meta.exposedAsSlash && !(meta.description ?? '').trim();
  const slashNameInvalid =
    meta.exposedAsSlash &&
    !!(meta.slashApiName ?? '').trim() &&
    !FLOW_SLASH_NAME_RE.test((meta.slashApiName ?? '').trim());

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      {/* Flow identity — icon + name + api_name / slash pills + dirty indicator. */}
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
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white',
            dirty ? 'bg-amber-600' : 'bg-emerald-600',
          )}
        >
          {dirty ? 'Unsaved' : 'Saved'}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* ── Graph meta (Save-gated) ── */}
        <Input
          id="flow-description"
          aria-label="Description"
          className="h-8 min-w-[14rem] flex-1 text-sm"
          value={meta.description ?? ''}
          onChange={(e) => setMeta({ description: e.target.value || null })}
          placeholder="Describe what this flow does — the LLM reads this to decide when to invoke it"
        />

        <label className="flex h-8 shrink-0 select-none items-center gap-1.5 text-sm text-foreground">
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
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <FlowYamlActions apiName={flow.apiName} />
        </div>
      </div>

      {/* Inline hints — only render when something needs attention. */}
      {(descriptionMissing || slashNameInvalid) && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {descriptionMissing && (
            <p className="text-[11px] text-amber-600">
              Add a description before exposing — the LLM uses it as the tool description.
            </p>
          )}
          {slashNameInvalid && (
            <p className="text-[11px] text-amber-600">{ERRORS.FLW_008.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
