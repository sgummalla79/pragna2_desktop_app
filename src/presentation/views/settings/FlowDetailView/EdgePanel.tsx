/**
 * Side-panel edge inspector for the selected canvas edge.
 *
 * Opens when the user clicks an edge. Shows the source → target identity and
 * a routing-condition select, plus a delete button. Edits write to the
 * Zustand store via `setEdgeCondition` / `deleteEdge` only — nothing persists
 * until the flow is Saved.
 *
 * Ported from the web app's EdgePanel — including the dynamic-dispatch (#35)
 * editor (dispatch_mode / items_slot / item_slot): a "Send per item" toggle
 * plus the items-slot / item-slot dropdowns, gated by the same source/target
 * validity rules.
 *
 * Note: for edges leaving a Decision node the routing condition is derived
 * from the source port handle (graphToYaml reads the handle, not
 * `data.condition`); the select below is the authoring surface for plain
 * (non-Decision-sourced) edges.
 */

import { Info, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  EDGE_CONDITIONS,
  EDGE_CONDITION_LABELS,
  type EdgeConditionValue,
} from '@/constants/edgeConditions';
import {
  type AgentNodeData,
  type ConditionEdgeData,
  DISPATCH_MODE_PER_ITEM,
  NODE_TYPE_AGENT,
  NODE_TYPE_DECISION,
  SLOT_USER_QUERY,
  isEndInstanceId,
} from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

const CONDITION_VALUES = Object.values(EDGE_CONDITIONS) as EdgeConditionValue[];

/** A literal value the items-slot dropdown ALWAYS offers — the BE resolves it
 *  from the latest user message rather than a real channel. */
const ITEMS_SLOT_OPTIONS_BUILTIN: readonly string[] = [SLOT_USER_QUERY];

export function EdgePanel() {
  const selectedEdgeId = useFlowEditorStore((s) => s.selectedEdgeId);
  const edge = useFlowEditorStore((s) => s.edges.find((e) => e.id === s.selectedEdgeId));
  const sourceNode = useFlowEditorStore((s) => s.nodes.find((n) => n.id === edge?.source));
  const targetNode = useFlowEditorStore((s) => s.nodes.find((n) => n.id === edge?.target));
  const setEdgeCondition = useFlowEditorStore((s) => s.setEdgeCondition);
  const updateEdgeData = useFlowEditorStore((s) => s.updateEdgeData);
  const deleteEdge = useFlowEditorStore((s) => s.deleteEdge);
  const selectEdge = useFlowEditorStore((s) => s.selectEdge);

  if (!edge || !selectedEdgeId) return null;

  const data: ConditionEdgeData = edge.data ?? { condition: EDGE_CONDITIONS.DEFAULT };
  // Decision-sourced edges derive their condition from the port handle; the
  // select is read-only in that case to avoid a misleading no-op edit.
  const conditionIsDerived = sourceNode?.type === NODE_TYPE_DECISION;

  const dispatchOn = data.dispatchMode === DISPATCH_MODE_PER_ITEM;

  // ── Mutual-exclusion gate (#35) ────────────────────────────────────
  // A source agent with a non-empty `emits` list already branches; a node
  // either branches OR fans out, not both (v1). Dispatch is also only valid
  // from an agent node (not __start__ / boundary).
  const sourceIsAgent = sourceNode?.type === NODE_TYPE_AGENT;
  const sourceEmits = sourceIsAgent ? (sourceNode!.data as AgentNodeData).agent.emits : [];
  const dispatchBlockedReason = !sourceIsAgent
    ? 'Dispatch is only available on edges from agent nodes (not __start__ or boundary nodes).'
    : sourceEmits.length > 0
      ? `Agent "${(sourceNode!.data as AgentNodeData).agent.apiName}" already branches via emits ${JSON.stringify(sourceEmits)}. A node either branches or fans out — not both (v1).`
      : null;

  // The BE rejects dispatch to a boundary / __end__; surface it up-front to
  // avoid a 422 on Save.
  const targetIsBoundary = !targetNode || targetNode.type !== NODE_TYPE_AGENT;
  const targetIsEnd = isEndInstanceId(edge.target);
  const targetBlockedReason = targetIsEnd
    ? 'Dispatch target cannot be __end__ (the per-instance Send must hit a concrete node).'
    : targetIsBoundary
      ? 'Dispatch target must be a concrete agent node.'
      : null;

  // items-slot is fed by the SOURCE node's `outputs` plus the reserved
  // `user_query` virtual slot; item-slot must be one of the TARGET's `inputs`.
  const sourceOutputs = sourceIsAgent ? ((sourceNode!.data as AgentNodeData).outputs ?? []) : [];
  const itemsSlotOptions = [...sourceOutputs, ...ITEMS_SLOT_OPTIONS_BUILTIN];
  const targetInputs =
    targetNode?.type === NODE_TYPE_AGENT
      ? ((targetNode.data as AgentNodeData).inputs ?? [])
      : [];

  function setDispatchOn(on: boolean) {
    if (on) {
      // Preserve existing slot picks if the user toggles off/on again.
      updateEdgeData(selectedEdgeId!, {
        dispatchMode: DISPATCH_MODE_PER_ITEM,
        itemsSlot: data.itemsSlot ?? itemsSlotOptions[0],
        itemSlot: data.itemSlot ?? targetInputs[0],
      });
    } else {
      // All-or-none invariant — clear all three together.
      updateEdgeData(selectedEdgeId!, {
        dispatchMode: undefined,
        itemsSlot: undefined,
        itemSlot: undefined,
      });
    }
  }

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex flex-col">
          <h2 className="text-sm font-semibold">Edge</h2>
          <p className="text-xs text-muted-foreground">
            {edge.source}
            {' → '}
            {edge.target}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close edge inspector"
          onClick={() => selectEdge(null)}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-1.5">
          <Label htmlFor="ep-condition" className="text-xs uppercase tracking-wide text-muted-foreground">
            Routing condition
          </Label>
          {conditionIsDerived ? (
            <>
              <p className="font-mono text-sm">{data.condition}</p>
              <p className="text-xs text-muted-foreground">
                Derived from the source port on the Decision node — change it by re-routing the
                edge to a different port.
              </p>
            </>
          ) : (
            <>
              <Select
                value={data.condition}
                onValueChange={(v) => setEdgeCondition(selectedEdgeId, v as EdgeConditionValue)}
              >
                <SelectTrigger id="ep-condition" size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_VALUES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EDGE_CONDITION_LABELS[c] ?? c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How the runtime should treat this edge when leaving the source node.
              </p>
            </>
          )}
        </section>

        {/* ── Dynamic fan-out (#35) ─────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Dynamic fan-out
            </Label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={dispatchOn}
                onChange={(e) => setDispatchOn(e.target.checked)}
                disabled={!!dispatchBlockedReason || !!targetBlockedReason}
                aria-label="Toggle dynamic fan-out (Send per item)"
              />
              <span>Send per item</span>
            </label>
          </div>

          {(dispatchBlockedReason || targetBlockedReason) && !dispatchOn && (
            <div
              className="flex items-start gap-2 rounded-md border border-border bg-muted/50 p-2 text-xs text-muted-foreground"
              role="note"
            >
              <Info size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>{dispatchBlockedReason ?? targetBlockedReason}</span>
            </div>
          )}

          {dispatchOn && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Items slot (source list)</Label>
                <Select
                  value={data.itemsSlot ?? ''}
                  onValueChange={(v) => updateEdgeData(selectedEdgeId, { itemsSlot: v })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Pick a slot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {itemsSlotOptions.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                        {slot === SLOT_USER_QUERY && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (latest user message)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {sourceOutputs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Source node has no declared <span className="font-mono">outputs</span>. Add an
                    output slot on the source to feed the fan-out.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Item slot (per-instance payload)</Label>
                <Select
                  value={data.itemSlot ?? ''}
                  onValueChange={(v) => updateEdgeData(selectedEdgeId, { itemSlot: v })}
                  disabled={targetInputs.length === 0}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="Pick a slot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetInputs.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {targetInputs.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Target node has no declared <span className="font-mono">inputs</span>. Add an
                    input slot on the target to receive the per-instance payload.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Runtime: one parallel invocation of{' '}
                <span className="font-mono">{edge.target}</span> per item in{' '}
                <span className="font-mono">{data.itemsSlot ?? '?'}</span>, bound to{' '}
                <span className="font-mono">{data.itemSlot ?? '?'}</span> on each instance.
              </p>
            </div>
          )}
        </section>

        <section className="border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:text-destructive"
            onClick={() => {
              if (window.confirm('Delete this edge?')) deleteEdge(selectedEdgeId);
            }}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete edge
          </Button>
        </section>
      </div>
    </aside>
  );
}
