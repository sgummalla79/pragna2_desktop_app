/**
 * Per-connector tool toggle list. Reads the flat `/api/tools` inventory,
 * filters to one connector's tools (the BE stamps `mcpConnectorId` on every
 * MCP tool row), and renders a checkbox per tool. Shared by the connector card
 * body and the Add-connector wizard's final "select tools" step.
 */

import { useMemo, useState } from 'react';
import { ERRORS } from '@/constants/errors';
import { useTools, useToggleTool } from '@/presentation/hooks/tools/useTools';

interface Props {
  /** The connector whose tools to list. */
  connectorId: string;
  /** Message when the connector has no tools yet. */
  emptyHint?: string;
}

/** Renders a checkbox per discovered tool, toggling its per-user enabled flag. */
export function ConnectorToolToggleList({ connectorId, emptyHint }: Props) {
  const { data: allTools = [] } = useTools();
  const toggleTool = useToggleTool();
  const [error, setError] = useState<string | null>(null);

  const tools = useMemo(
    () =>
      allTools
        .filter((t) => t.mcpConnectorId === connectorId)
        .sort((a, b) => a.apiName.localeCompare(b.apiName)),
    [allTools, connectorId],
  );

  async function handleToggle(toolId: string, enabled: boolean) {
    setError(null);
    try {
      await toggleTool.mutateAsync({ id: toolId, payload: { enabled } });
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? ERRORS.TOOL_002.message;
      setError(String(detail));
    }
  }

  if (tools.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
        {emptyHint ??
          'No tools yet. Try refreshing — or this connector may not expose any.'}
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <ul className="divide-y divide-border">
        {tools.map((t) => (
          <li key={t.id} className="flex items-start gap-3 px-4 py-3">
            <input
              type="checkbox"
              id={`tool-toggle-${t.id}`}
              checked={t.enabled}
              onChange={(e) => handleToggle(t.id, e.target.checked)}
              disabled={toggleTool.isPending}
              className="mt-1 shrink-0 accent-primary"
            />
            <label
              htmlFor={`tool-toggle-${t.id}`}
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
            >
              <span className="truncate font-mono text-xs font-medium">
                {t.apiName}
              </span>
              {t.description && (
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {t.description}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
