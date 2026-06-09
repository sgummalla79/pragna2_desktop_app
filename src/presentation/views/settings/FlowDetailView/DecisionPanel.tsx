/**
 * Side-panel editor for a selected Decision (router) node.
 *
 * A Decision node is fed by exactly one upstream agent and routes that
 * agent's single emitted label to a branch. This panel edits the ordered
 * list of condition rows (`+` to add, `-` to remove) — each becomes an
 * output port on the node, matched by equality against the agent's emitted
 * label. An always-on `else` branch (shown read-only) catches anything
 * unmatched. Conditions are validated against the upstream agent's emits on
 * Save, not live here.
 *
 * Edits write to the Zustand store only; nothing persists until Save.
 */

import { useState } from 'react';
import { GitBranch, Minus, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type DecisionNodeData, NODE_TYPE_DECISION } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

export function DecisionPanel() {
  const node = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId && n.type === NODE_TYPE_DECISION),
  );
  const updateConditions = useFlowEditorStore((s) => s.updateConditions);
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const selectNode = useFlowEditorStore((s) => s.selectNode);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const data = node?.data as DecisionNodeData | undefined;
  if (!node || !data) return null;
  const nodeId = node.id;
  const conditions = data.conditions ?? [];

  function setConditionAt(idx: number, value: string) {
    updateConditions(
      nodeId,
      conditions.map((c, i) => (i === idx ? value : c)),
    );
  }
  function removeConditionAt(idx: number) {
    updateConditions(
      nodeId,
      conditions.filter((_, i) => i !== idx),
    );
  }
  function addCondition() {
    updateConditions(nodeId, [...conditions, '']);
  }

  return (
    <>
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"
              aria-hidden="true"
            >
              <GitBranch size={13} strokeWidth={2.2} />
            </span>
            <h2 className="text-sm font-semibold">If / else</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <p className="text-[11px] text-muted-foreground">
            Routes the single upstream agent's emitted label. Each condition is matched by equality
            and becomes an output port; the <code className="font-mono">else</code> branch fires
            when nothing matched. Conditions must be values the upstream agent can emit (checked on
            Save).
          </p>

          <div className="space-y-2">
            <Label>Conditions</Label>
            {conditions.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No conditions yet.</p>
            ) : (
              <div className="space-y-2">
                {conditions.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      aria-label={`Condition ${idx + 1}`}
                      value={c}
                      onChange={(e) => setConditionAt(idx, e.target.value)}
                      placeholder="passed"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeConditionAt(idx)}
                      aria-label={`Remove condition ${idx + 1}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Minus size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addCondition}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-border px-2.5 py-1.5 text-[12px] text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Plus size={14} aria-hidden="true" />
              Add condition
            </button>

            <div className="mt-1 flex items-center gap-2 rounded-md border border-dashed border-border/70 px-2.5 py-1.5">
              <span className="font-mono text-[12px] text-muted-foreground">else</span>
              <span className="text-[10px] text-muted-foreground">
                (always present — fires when no condition matched)
              </span>
            </div>
          </div>
        </div>

        <div className="flex justify-center border-t border-border p-3">
          <Button
            variant="destructive"
            size="sm"
            className="text-white"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete decision node
          </Button>
        </div>
      </aside>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this decision node?</DialogTitle>
            <DialogDescription>
              Its branches will be removed and the upstream agent will no longer route. Edges
              connected to it will be removed too.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="text-white"
              onClick={() => {
                setConfirmDeleteOpen(false);
                deleteNode(nodeId);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
