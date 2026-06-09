/**
 * "MCP connectors" section of the agent editor (edit mode only).
 *
 * Bindings are a sub-resource keyed by the agent id, which only exists after
 * the agent is created — so this renders only when editing an existing agent.
 * Unlike the rest of the form (saved on the Save button), connector changes
 * apply IMMEDIATELY via their own endpoints (attach / update-selection /
 * detach), mirroring the per-tool toggles on the connector card.
 *
 * Per binding the user picks which of the connector's tools the agent may use;
 * selecting all (or none) means "all enabled tools" (`selectedTools = null`).
 */

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Label } from '@/components/ui/label';
import { ConfirmButton } from '@/components/ui/confirm-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMcpConnectors } from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { useTools } from '@/presentation/hooks/tools/useTools';
import {
  useAgentConnectors,
  useAttachAgentConnector,
  useDetachAgentConnector,
  useUpdateAgentConnector,
} from '@/presentation/hooks/agents/useAgentConnectors';
import type { AgentConnector } from '@/domain/types/agentConnector.types';
import type { McpConnector } from '@/domain/types/mcp.types';
import type { Tool } from '@/domain/types/tool.types';

interface Props {
  agentId: string;
}

/** Reads `err.response.data.detail` if present, else the supplied fallback. */
function messageFrom(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response
    ?.data?.detail;
  if (detail) return String(detail);
  return err instanceof Error ? err.message : fallback;
}

/** Lists + manages the agent's connector bindings; changes apply immediately. */
export function AgentConnectorsSection({ agentId }: Props) {
  const { data: bindings = [] } = useAgentConnectors(agentId);
  const { data: connectors = [] } = useMcpConnectors();
  const { data: allTools = [] } = useTools();

  const attach = useAttachAgentConnector(agentId);
  const detach = useDetachAgentConnector(agentId);
  const [error, setError] = useState<string | null>(null);

  const connectorById = useMemo(() => {
    const m = new Map<string, McpConnector>();
    for (const c of connectors) m.set(c.id, c);
    return m;
  }, [connectors]);

  // Active connectors not already attached — the attach picker's options.
  const attachable = useMemo(() => {
    const chosen = new Set(bindings.map((b) => b.mcpConnectorId));
    return connectors.filter((c) => c.status === 'active' && !chosen.has(c.id));
  }, [connectors, bindings]);

  async function handleAttach(connectorId: string) {
    setError(null);
    try {
      // Attach with the full set by default (selectedTools = null).
      await attach.mutateAsync({ mcpConnectorId: connectorId, selectedTools: null });
    } catch (err) {
      setError(messageFrom(err, 'Failed to attach connector.'));
    }
  }

  async function handleDetach(bindingId: string) {
    setError(null);
    try {
      await detach.mutateAsync(bindingId);
    } catch (err) {
      setError(messageFrom(err, 'Failed to detach connector.'));
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <EntityIcon entity="connectors" size="sm" />
        <Label className="text-sm font-semibold">MCP connectors</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Give this agent a connector's tools. Changes apply immediately.
      </p>

      {bindings.length > 0 && (
        <ul className="flex flex-col gap-2">
          {bindings.map((b) => (
            <BindingRow
              key={b.id}
              agentId={agentId}
              binding={b}
              connector={connectorById.get(b.mcpConnectorId) ?? null}
              tools={allTools}
              onDetach={() => handleDetach(b.id)}
              onError={setError}
            />
          ))}
        </ul>
      )}

      {attachable.length > 0 ? (
        <Select value="" onValueChange={(v) => v && handleAttach(v)}>
          <SelectTrigger data-testid="agent-connector-attach" className="mt-1">
            <SelectValue placeholder="Attach a connector…" />
          </SelectTrigger>
          <SelectContent>
            {attachable.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : bindings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No connectors to attach. Register one under Settings → Connectors.
        </p>
      ) : null}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

interface BindingRowProps {
  agentId: string;
  binding: AgentConnector;
  connector: McpConnector | null;
  tools: Tool[];
  onDetach: () => void;
  onError: (msg: string | null) => void;
}

/** One attached-connector row with an expandable per-tool selection. */
function BindingRow({
  agentId,
  binding,
  connector,
  tools,
  onDetach,
  onError,
}: BindingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const update = useUpdateAgentConnector(agentId);

  // The connector's ENABLED tools are the selectable set (the BE intersects
  // the selection with enabled tools at resolve time anyway).
  const connectorTools = useMemo(
    () =>
      tools
        .filter((t) => t.mcpConnectorId === binding.mcpConnectorId && t.enabled)
        .sort((a, b) => a.apiName.localeCompare(b.apiName)),
    [tools, binding.mcpConnectorId],
  );
  const allApiNames = connectorTools.map((t) => t.apiName);

  // null/empty selection = ALL enabled tools.
  const isAll = !binding.selectedTools || binding.selectedTools.length === 0;
  const selectedSet = useMemo(
    () => new Set(isAll ? allApiNames : binding.selectedTools ?? []),
    [isAll, allApiNames, binding.selectedTools],
  );
  const selectedCount = isAll ? allApiNames.length : selectedSet.size;

  const name = connector?.displayName ?? 'Unknown connector';
  const summary = isAll
    ? `All tools (${allApiNames.length})`
    : `${selectedCount} of ${allApiNames.length} tools`;

  async function applySelection(nextChecked: Set<string>) {
    onError(null);
    // Selecting all → send null ("all enabled tools"), so newly-added upstream
    // tools are auto-included. A strict subset is sent verbatim.
    const next =
      nextChecked.size === allApiNames.length
        ? null
        : allApiNames.filter((n) => nextChecked.has(n));
    try {
      await update.mutateAsync({
        bindingId: binding.id,
        payload: { selectedTools: next },
      });
    } catch (err) {
      onError(messageFrom(err, 'Failed to update tool selection.'));
    }
  }

  function toggleTool(apiName: string, checked: boolean) {
    const next = new Set(isAll ? allApiNames : binding.selectedTools ?? []);
    if (checked) next.add(apiName);
    else next.delete(apiName);
    applySelection(next);
  }

  return (
    <li className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? (
            <ChevronDown size={14} aria-hidden="true" className="shrink-0" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" className="shrink-0" />
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {summary}
            </span>
          </span>
        </button>
        <ConfirmButton
          size="sm"
          variant="ghost"
          confirmTitle={`Detach '${name}'?`}
          confirmDescription="This agent will lose access to this connector's tools. You can re-attach it later."
          confirmLabel="Detach"
          onConfirm={onDetach}
        >
          Detach
        </ConfirmButton>
      </div>

      {expanded && (
        <div className="border-t border-border px-3 py-2">
          {connectorTools.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No enabled tools. Enable some on the connector card, or refresh it.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {connectorTools.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`binding-${binding.id}-tool-${t.id}`}
                    checked={selectedSet.has(t.apiName)}
                    onChange={(e) => toggleTool(t.apiName, e.target.checked)}
                    disabled={update.isPending}
                    className="mt-0.5 shrink-0 accent-primary"
                  />
                  <label
                    htmlFor={`binding-${binding.id}-tool-${t.id}`}
                    className="min-w-0 flex-1 cursor-pointer truncate font-mono text-xs"
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
