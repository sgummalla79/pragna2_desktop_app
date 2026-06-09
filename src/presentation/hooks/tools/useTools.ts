/**
 * TanStack Query hooks for the `/api/tools` endpoints.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import {
  MCP_CONNECTORS_KEY,
  TOOLS_KEY,
} from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import type { Tool, UpdateToolPayload } from '@/domain/types/tool.types';

/** List the flat tool inventory (global + per-user). */
export function useTools() {
  const { toolService } = useServices();
  return useQuery({
    queryKey: TOOLS_KEY,
    queryFn: () => toolService.list(),
    staleTime: 30_000,
  });
}

/** Toggle the per-user `enabled` flag.
 *  Invalidates both the tools list AND the connectors list, since the
 *  per-connector `tools.enabled` count is derived from the tool flags. */
export function useToggleTool() {
  const { toolService } = useServices();
  const qc = useQueryClient();
  return useMutation<Tool, Error, { id: string; payload: UpdateToolPayload }>({
    mutationFn: ({ id, payload }) => toolService.setEnabled(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
    },
  });
}
