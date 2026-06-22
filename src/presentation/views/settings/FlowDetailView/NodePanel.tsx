/**
 * Side-panel agent editor for the selected canvas node.
 *
 * Opening an agent node shows its inline, flow-owned agent definition; a
 * freshly-added node opens with a blank form. Edits write to the Zustand
 * store only — nothing is persisted until the flow is Saved.
 *
 * Ported from the web app's NodePanel. The full-screen "maximize" layout
 * variant was dropped (a pure layout convenience — no data); the context
 * variable slots (#26 inputs/outputs) are kept in a collapsible block so
 * those fields still round-trip through the store/serialization. Tools use
 * the shared ChipInput (the web app's ToolPicker isn't part of this port).
 */

import { useEffect, useMemo, useState } from 'react';
import { Bot, Trash2, X } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  FLOW_AGENT_MODEL_INHERIT,
  FLOW_AGENT_MODEL_INHERIT_LABEL,
} from '@/constants/flows';
import { cn } from '@/lib/utils';
import { useModels } from '@/presentation/hooks/models/useModels';
import { useTools } from '@/presentation/hooks/tools/useTools';
import { ChipInput } from '@/presentation/views/settings/AgentsView/ChipInput';
import { type AgentNodeData, NODE_END, NODE_START, NODE_TYPE_AGENT } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

const RESERVED_NODE_IDS = new Set<string>([NODE_START, NODE_END]);

export function NodePanel() {
  const selectedNodeId = useFlowEditorStore((s) => s.selectedNodeId);
  const node = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId && n.type === NODE_TYPE_AGENT),
  );
  const updateNode = useFlowEditorStore((s) => s.updateNode);
  const updateAgent = useFlowEditorStore((s) => s.updateAgent);

  // Enabled tools (by api_name) power the agent-tools autocomplete (pragna2-tracker TD-010).
  const { data: tools } = useTools();
  const toolSuggestions = useMemo(
    () => (tools ?? []).filter((t) => t.enabled).map((t) => t.apiName),
    [tools],
  );
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const selectNode = useFlowEditorStore((s) => s.selectNode);
  const allNodes = useFlowEditorStore((s) => s.nodes);
  const otherNodeIds = useMemo(
    () => allNodes.filter((n) => n.id !== selectedNodeId).map((n) => n.id),
    [allNodes, selectedNodeId],
  );

  const { data: models = [] } = useModels();
  const flowEligibleModels = useMemo(
    () => models.filter((m) => m.enabled && !m.archived && m.availableForFlows),
    [models],
  );

  // node_id is edited locally and committed on blur — renaming on every
  // keystroke would rewire edges (and break on an empty intermediate).
  const data = node?.data as AgentNodeData | undefined;
  const [nodeIdDraft, setNodeIdDraft] = useState(data?.nodeId ?? '');
  const [nodeIdError, setNodeIdError] = useState<string | null>(null);
  useEffect(() => {
    setNodeIdDraft(data?.nodeId ?? '');
    setNodeIdError(null);
  }, [data?.nodeId, selectedNodeId]);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  if (!node || !data) return null;
  const agent = data.agent;
  const nodeId = node.id;

  function commitNodeId() {
    const next = nodeIdDraft.trim();
    if (next === data!.nodeId) {
      setNodeIdError(null);
      return;
    }
    if (!next) {
      setNodeIdError('Agent id is required.');
      setNodeIdDraft(data!.nodeId);
      return;
    }
    if (RESERVED_NODE_IDS.has(next)) {
      setNodeIdError(`'${next}' is reserved for the Start/End boundaries.`);
      setNodeIdDraft(data!.nodeId);
      return;
    }
    if (otherNodeIds.includes(next)) {
      setNodeIdError(`Another node already uses '${next}'. Ids must be unique.`);
      setNodeIdDraft(data!.nodeId);
      return;
    }
    setNodeIdError(null);
    updateNode(nodeId, { nodeId: next });
  }

  return (
    <>
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-500 text-white"
              aria-hidden="true"
            >
              <Bot size={13} strokeWidth={2.2} />
            </span>
            <h2 className="text-sm font-semibold">Agent</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <Label htmlFor="np-node-id">Agent</Label>
            <Input
              id="np-node-id"
              value={nodeIdDraft}
              onChange={(e) => setNodeIdDraft(e.target.value)}
              onBlur={commitNodeId}
              placeholder="researcher_1"
              aria-invalid={nodeIdError ? true : undefined}
            />
            {nodeIdError ? (
              <p role="alert" className="text-[11px] text-destructive">
                {nodeIdError}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Unique within this flow. Used in edges, as the agent's label, and as its api_name (
                <code className="font-mono">{agent.apiName || 'researcher_1'}</code>).
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-agent-display">Display name</Label>
            <Input
              id="np-agent-display"
              value={agent.displayName}
              onChange={(e) => updateAgent(nodeId, { displayName: e.target.value })}
              placeholder="e.g. Researcher"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-agent-desc">Description (optional)</Label>
            <Input
              id="np-agent-desc"
              value={agent.description ?? ''}
              onChange={(e) => updateAgent(nodeId, { description: e.target.value || null })}
              placeholder="e.g. Generates the primary draft."
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-agent-model">Model (optional)</Label>
            <Select
              value={agent.userModel || FLOW_AGENT_MODEL_INHERIT}
              onValueChange={(v) =>
                updateAgent(nodeId, {
                  userModel: v === FLOW_AGENT_MODEL_INHERIT ? '' : v,
                })
              }
            >
              <SelectTrigger id="np-agent-model" className="w-full">
                <SelectValue placeholder={FLOW_AGENT_MODEL_INHERIT_LABEL} />
              </SelectTrigger>
              <SelectContent>
                {/* Blank model — the backend resolves it to the conversation's
                    selected model at run time (pragna2-tracker #184). */}
                <SelectItem value={FLOW_AGENT_MODEL_INHERIT}>
                  {FLOW_AGENT_MODEL_INHERIT_LABEL}
                </SelectItem>
                {flowEligibleModels.map((m) => (
                  <SelectItem key={m.id} value={m.modelName}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Leave as "{FLOW_AGENT_MODEL_INHERIT_LABEL}" to run this agent on
              whatever model the conversation has selected when the flow runs.
            </p>
            {flowEligibleModels.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                No models enabled for Flows. Toggle "Available for flows" on a model in Settings →
                Providers.
              </p>
            )}
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="np-agent-prompt">System prompt</Label>
            <Textarea
              id="np-agent-prompt"
              value={agent.systemPrompt}
              onChange={(e) => updateAgent(nodeId, { systemPrompt: e.target.value })}
              placeholder="e.g. You are a careful researcher."
              className="min-h-[10rem] resize-y font-mono text-[12.5px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-agent-emits">Emit labels</Label>
            <ChipInput
              id="np-agent-emits"
              label="emit"
              values={agent.emits}
              onChange={(emits) => updateAgent(nodeId, { emits })}
              placeholder="passed, failed (Enter to add)"
            />
            <p className="text-[11px] text-muted-foreground">
              Labels this agent may emit (it produces exactly one). To branch on them, feed this
              agent into a <strong>Decision</strong> node and add matching conditions there.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-agent-tools">Tools (optional)</Label>
            <ChipInput
              id="np-agent-tools"
              label="tool"
              values={agent.tools}
              onChange={(tools) => updateAgent(nodeId, { tools })}
              suggestions={toolSuggestions}
              placeholder="Type a tool api_name (Enter to add)"
            />
          </div>

          {/* #26 context variables — collapsed to save the cramped column.
              Kept so inputs/outputs round-trip through the store. */}
          <details className="rounded-md border border-border">
            <summary className="cursor-pointer px-3 py-2 text-[12px] font-medium text-muted-foreground">
              Context variables (advanced)
            </summary>
            <div className="space-y-3 px-3 pb-3">
              <div className="space-y-1.5">
                <Label htmlFor="np-inputs">Inputs</Label>
                <ChipInput
                  id="np-inputs"
                  label="input slot"
                  values={data.inputs ?? []}
                  onChange={(inputs) => updateNode(nodeId, { inputs })}
                  placeholder="research_notes, user_query"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="np-outputs">Outputs</Label>
                <ChipInput
                  id="np-outputs"
                  label="output slot"
                  values={data.outputs ?? []}
                  onChange={(outputs) => updateNode(nodeId, { outputs })}
                  placeholder="research_notes"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave empty for default chat-style context. Declaring inputs feeds the node ONLY
                those slots (#26).
              </p>
            </div>
          </details>
        </div>

        <div className="flex justify-center border-t border-border p-3">
          <Button
            variant="destructive"
            size="sm"
            className="text-white"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete agent
          </Button>
        </div>
      </aside>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this agent?</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-foreground">{agent.apiName || nodeId}</span> and all
              edges connected to it will be removed from the flow. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className={cn('text-white')}
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
