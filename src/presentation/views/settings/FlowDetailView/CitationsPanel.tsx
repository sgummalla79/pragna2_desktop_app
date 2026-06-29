/**
 * Side-panel editor for a selected Citations node (BE #233 source-aggregation).
 *
 * A Citations node is deterministic (no LLM): it reads an accumulated source
 * list and a synthesis draft that cites sources inline with `[[marker]]`s, then
 * resolves those markers into numbered `[n]` references plus a `## References`
 * section. The three slot names are OPTIONAL — left blank, the BE applies its
 * canonical defaults (`sources` / `draft` / `cited_report`), shown here as the
 * input placeholders. Edits write to the Zustand store only; nothing persists
 * until Save.
 *
 * The simplest deterministic panel — no list management like Knowledge/
 * Connector, just three optional slot-name inputs. Mirrors the KnowledgePanel
 * chrome (header, scroll body, delete-with-confirm).
 */

import { useState } from 'react';
import { Quote, Trash2, X } from 'lucide-react';

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
import {
  type CitationsNodeData,
  CITATIONS_DEFAULT_DRAFT_SLOT,
  CITATIONS_DEFAULT_OUTPUT_SLOT,
  CITATIONS_DEFAULT_SOURCES_SLOT,
  NODE_TYPE_CITATIONS,
} from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

export function CitationsPanel() {
  const node = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId && n.type === NODE_TYPE_CITATIONS),
  );
  const updateCitationsFields = useFlowEditorStore((s) => s.updateCitationsFields);
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const selectNode = useFlowEditorStore((s) => s.selectNode);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const data = node?.data as CitationsNodeData | undefined;
  if (!node || !data) return null;
  const nodeId = node.id;

  // A blank field clears the slot (stored as undefined) so the YAML omits it and
  // the BE falls back to its default — never persist an empty string.
  const patch = (key: keyof Omit<CitationsNodeData, 'nodeId'>, value: string) =>
    updateCitationsFields(nodeId, { [key]: value.trim() === '' ? undefined : value });

  return (
    <>
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-cyan-500 text-white"
              aria-hidden="true"
            >
              <Quote size={13} strokeWidth={2.2} />
            </span>
            <h2 className="text-sm font-semibold">Citations</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <p className="text-[11px] text-muted-foreground">
            Deterministic — no model. Reads an upstream source list and a draft that cites sources
            inline as <code>[[marker]]</code>, then writes a report with numbered <code>[n]</code>{' '}
            references and a References list. Leave a slot blank to use its default.
          </p>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-sources-slot">Sources slot</Label>
              <Input
                id="cp-sources-slot"
                value={data.sourcesSlot ?? ''}
                placeholder={CITATIONS_DEFAULT_SOURCES_SLOT}
                onChange={(e) => patch('sourcesSlot', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                State slot holding the accumulated source list. Must be produced upstream.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-draft-slot">Draft slot</Label>
              <Input
                id="cp-draft-slot"
                value={data.draftSlot ?? ''}
                placeholder={CITATIONS_DEFAULT_DRAFT_SLOT}
                onChange={(e) => patch('draftSlot', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                State slot holding the synthesis draft with <code>[[marker]]</code> citations.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cp-output-slot">Output slot</Label>
              <Input
                id="cp-output-slot"
                value={data.outputSlot ?? ''}
                placeholder={CITATIONS_DEFAULT_OUTPUT_SLOT}
                onChange={(e) => patch('outputSlot', e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                State slot the resolved cited report is written to (and shown to the user).
              </p>
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
            Delete citations node
          </Button>
        </div>
      </aside>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this citations node?</DialogTitle>
            <DialogDescription>
              Edges connected to it will be removed too. This can&apos;t be undone.
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
