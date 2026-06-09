/**
 * Side-panel editor for a selected MCP Connector node.
 *
 * An MCP Connector node declares one or more MCP servers; every agent node
 * DOWNSTREAM of it inherits all of those connectors' (enabled) tools. This
 * panel lets the author add/remove connectors and narrow each to a tool
 * subset. Each is stored as a frozen snapshot of the server's identity
 * (`sourceServerId` + `url` + `displayName`; never the secret).
 *
 * Ported from the web app's ConnectorPanel. The inline "register a new
 * connector" form (web-app RegisterConnectorForm) is omitted from this port —
 * the add dialog picks one of the user's already-registered connectors;
 * new ones are created under Settings → Connectors. The per-connector tool
 * selection (`selectedTools`) is preserved and round-trips through the store.
 *
 * Edits write to the Zustand store only; nothing persists until Save.
 */

import { useMemo, useState } from 'react';
import { Cable, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useMcpConnectors } from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { useTools } from '@/presentation/hooks/tools/useTools';
import type { McpConnector } from '@/domain/types/mcp.types';
import type { Tool } from '@/domain/types/tool.types';
import { type ConnectorNodeData, type EditorConnector, NODE_TYPE_CONNECTOR } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

function urlOf(config: Record<string, unknown> | undefined): string {
  return config && typeof config.url === 'string' ? config.url : '';
}

export function ConnectorPanel() {
  const node = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId && n.type === NODE_TYPE_CONNECTOR),
  );
  const updateConnectors = useFlowEditorStore((s) => s.updateConnectors);
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const selectNode = useFlowEditorStore((s) => s.selectNode);

  const { data: availableConnectors = [], isLoading } = useMcpConnectors();
  const { data: allTools = [] } = useTools();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const data = node?.data as ConnectorNodeData | undefined;
  const connectors = data?.connectors ?? [];

  const addable = useMemo(() => {
    const chosen = new Set(connectors.map((c) => c.sourceServerId));
    return availableConnectors.filter((c) => c.status === 'active' && !chosen.has(c.id));
  }, [availableConnectors, connectors]);

  if (!node || !data) return null;
  const nodeId = node.id;

  function appendConnector(next: EditorConnector) {
    if (connectors.some((c) => c.sourceServerId === next.sourceServerId)) return;
    updateConnectors(nodeId, [...connectors, next]);
  }

  function pickConnector(connector: McpConnector) {
    appendConnector({
      sourceServerId: connector.id,
      url: urlOf(connector.config),
      displayName: connector.displayName,
    });
    setAddOpen(false);
  }

  function removeConnector(serverId: string) {
    updateConnectors(
      nodeId,
      connectors.filter((c) => c.sourceServerId !== serverId),
    );
  }

  function setConnectorSelection(serverId: string, selected: string[] | null) {
    updateConnectors(
      nodeId,
      connectors.map((c) =>
        c.sourceServerId === serverId ? { ...c, selectedTools: selected } : c,
      ),
    );
  }

  return (
    <>
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-500 text-white"
              aria-hidden="true"
            >
              <Cable size={13} strokeWidth={2.2} />
            </span>
            <h2 className="text-sm font-semibold">MCP</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <p className="text-[11px] text-muted-foreground">
            Every agent node downstream of this one can use all of these connectors' tools. The
            connector's credentials stay on your account — only its identity travels with the flow.
          </p>

          <div className="space-y-2">
            <Label>Connectors</Label>
            {connectors.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No connectors added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {connectors.map((c) => (
                  <ConnectorRow
                    key={c.sourceServerId}
                    connector={c}
                    tools={allTools}
                    onRemove={() => removeConnector(c.sourceServerId)}
                    onSelectionChange={(sel) => setConnectorSelection(c.sourceServerId, sel)}
                  />
                ))}
              </ul>
            )}
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Add a connector
          </Button>
        </div>

        <div className="flex justify-center border-t border-border p-3">
          <Button
            variant="destructive"
            size="sm"
            className="text-white"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete connector node
          </Button>
        </div>
      </aside>

      {/* Add-connector modal — pick one of your registered connectors. Create
          new ones under Settings → Connectors. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add MCP connector</DialogTitle>
            <DialogDescription>
              Pick one of your registered connectors. Create new ones under Settings → Connectors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Your connectors</Label>
            {isLoading ? (
              <p className="text-[12px] text-muted-foreground">Loading…</p>
            ) : addable.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No connectors to add. Register one under Settings → Connectors.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {addable.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickConnector(c)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left transition hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {c.displayName}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {urlOf(c.config)}
                        </span>
                      </span>
                      <Plus size={14} aria-hidden="true" className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this connector node?</DialogTitle>
            <DialogDescription>
              Downstream agents will lose access to its connectors' tools. Edges connected to it
              will be removed too.
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

interface ConnectorRowProps {
  connector: EditorConnector;
  tools: Tool[];
  onRemove: () => void;
  onSelectionChange: (selected: string[] | null) => void;
}

/**
 * One connector on the node: identity + an expandable per-tool checklist.
 * Selecting all (or none) means "all enabled tools" (`selectedTools = null`);
 * a strict subset narrows what downstream agents may call.
 */
function ConnectorRow({ connector, tools, onRemove, onSelectionChange }: ConnectorRowProps) {
  const [expanded, setExpanded] = useState(false);

  const connectorTools = useMemo(
    () =>
      tools
        .filter((t) => t.mcpConnectorId === connector.sourceServerId && t.enabled)
        .sort((a, b) => a.apiName.localeCompare(b.apiName)),
    [tools, connector.sourceServerId],
  );
  const allApiNames = connectorTools.map((t) => t.apiName);

  const isAll = !connector.selectedTools || connector.selectedTools.length === 0;
  const selectedSet = useMemo(
    () => new Set(isAll ? allApiNames : connector.selectedTools ?? []),
    [isAll, allApiNames, connector.selectedTools],
  );
  const summary = isAll
    ? `All tools${allApiNames.length ? ` (${allApiNames.length})` : ''}`
    : `${selectedSet.size} of ${allApiNames.length} tools`;

  function toggleTool(apiName: string, checked: boolean) {
    const next = new Set(isAll ? allApiNames : connector.selectedTools ?? []);
    if (checked) next.add(apiName);
    else next.delete(apiName);
    onSelectionChange(
      next.size === allApiNames.length ? null : allApiNames.filter((n) => next.has(n)),
    );
  }

  return (
    <li className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown size={13} aria-hidden="true" className="shrink-0" />
          ) : (
            <ChevronRight size={13} aria-hidden="true" className="shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-medium">{connector.displayName}</span>
            <span className="block truncate text-[10px] text-muted-foreground">{summary}</span>
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${connector.displayName}`}
          onClick={onRemove}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      </div>

      {expanded && (
        <div className="border-t border-border px-2.5 py-2">
          {connectorTools.length === 0 ? (
            <p className="text-[10.5px] text-muted-foreground">
              No enabled tools. Enable some on the connector card (Settings → Connectors), or
              refresh it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {connectorTools.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`flow-conn-${connector.sourceServerId}-tool-${t.id}`}
                    checked={selectedSet.has(t.apiName)}
                    onChange={(e) => toggleTool(t.apiName, e.target.checked)}
                    className="mt-0.5 shrink-0"
                  />
                  <label
                    htmlFor={`flow-conn-${connector.sourceServerId}-tool-${t.id}`}
                    className="min-w-0 flex-1 cursor-pointer truncate font-mono text-[10.5px]"
                  >
                    {t.apiName}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
