/**
 * Side-panel edge inspector for the selected canvas edge.
 *
 * Opens when the user clicks an edge. Shows the source → target identity and
 * a routing-condition select, plus a delete button. Edits write to the
 * Zustand store via `setEdgeCondition` / `deleteEdge` only — nothing persists
 * until the flow is Saved.
 *
 * Ported from the web app's EdgePanel. The dynamic-dispatch (#35) editor
 * (dispatch_mode / items_slot / item_slot) is intentionally omitted from this
 * port; those fields are NOT stripped — they're carried verbatim by the store
 * and serialization, so any flow that already uses dispatch still round-trips.
 *
 * Note: for edges leaving a Decision node the routing condition is derived
 * from the source port handle (graphToYaml reads the handle, not
 * `data.condition`); the select below is the authoring surface for plain
 * (non-Decision-sourced) edges.
 */

import { Trash2, X } from 'lucide-react';

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
import { NODE_TYPE_DECISION, type ConditionEdgeData } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

const CONDITION_VALUES = Object.values(EDGE_CONDITIONS) as EdgeConditionValue[];

export function EdgePanel() {
  const selectedEdgeId = useFlowEditorStore((s) => s.selectedEdgeId);
  const edge = useFlowEditorStore((s) => s.edges.find((e) => e.id === s.selectedEdgeId));
  const sourceNode = useFlowEditorStore((s) => s.nodes.find((n) => n.id === edge?.source));
  const setEdgeCondition = useFlowEditorStore((s) => s.setEdgeCondition);
  const deleteEdge = useFlowEditorStore((s) => s.deleteEdge);
  const selectEdge = useFlowEditorStore((s) => s.selectEdge);

  if (!edge || !selectedEdgeId) return null;

  const data: ConditionEdgeData = edge.data ?? { condition: EDGE_CONDITIONS.DEFAULT };
  // Decision-sourced edges derive their condition from the port handle; the
  // select is read-only in that case to avoid a misleading no-op edit.
  const conditionIsDerived = sourceNode?.type === NODE_TYPE_DECISION;

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
