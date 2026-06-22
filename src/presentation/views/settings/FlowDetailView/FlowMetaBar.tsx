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

  return (
    <div className="shrink-0 border-b border-border px-4 py-2">
      {/* Flow identity — icon + name + api_name / slash pills + dirty indicator. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <EntityIcon entity="flows" />
        <span className="text-sm font-semibold text-foreground">{flow.displayName}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {flow.apiName}
        </span>
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
        {/* ── Graph meta (Save-gated) ──
            Slash exposure + the slash name are managed on the flow card in the
            list (it owns the immediate `/slash-exposure` mutation), so they are
            intentionally NOT duplicated here — the editor only edits the
            description. */}
        <Input
          id="flow-description"
          aria-label="Description"
          className="h-8 min-w-[14rem] flex-1 text-sm"
          value={meta.description ?? ''}
          onChange={(e) => setMeta({ description: e.target.value || null })}
          placeholder="Describe what this flow does — the LLM reads this to decide when to invoke it"
        />

        {/* ── Actions (right cluster) ── */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <FlowYamlActions apiName={flow.apiName} />
        </div>
      </div>
    </div>
  );
}
