/**
 * TanStack Query hooks for the MCP connector endpoints.
 *
 * Mirrors the shape of `presentation/hooks/providers/useProviders.ts`.
 * Mutations invalidate both `['mcp-connectors']` (so the list refetches with
 * the new state) AND `['tools']` (because every connector mutation —
 * register / refresh / archive — changes the user's tool inventory).
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useServices } from '@/presentation/providers/ServiceContext';
import type { ConnectViaLoopbackResult } from '@/application/services/McpConnectorService';
import type {
  CreateMcpConnectorPayload,
  McpConnector,
  RefreshToolsResult,
  RegisteredMcpConnector,
  StartOAuthPayload,
  StartOAuthResult,
  UpdateMcpConnectorPayload,
} from '@/domain/types/mcp.types';

/** Cache key used by both reads + invalidations. */
export const MCP_CONNECTORS_KEY = ['mcp-connectors'] as const;
/** Cache key for the tools list — touched by every connector mutation
 *  since they all change the discoverable tool set. */
export const TOOLS_KEY = ['tools'] as const;

/** List the user's active MCP connectors. */
export function useMcpConnectors() {
  const { mcpConnectorService } = useServices();
  return useQuery({
    queryKey: MCP_CONNECTORS_KEY,
    queryFn: () => mcpConnectorService.list(),
    staleTime: 30_000,
  });
}

/** Register a new MCP connector. Invalidates connectors + tools on success. */
export function useRegisterMcpConnector() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  return useMutation<RegisteredMcpConnector, Error, CreateMcpConnectorPayload>({
    mutationFn: (payload) => mcpConnectorService.register(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Partial update — display_name / description / auth_type / status /
 *  credentials. */
export function useUpdateMcpConnector() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  return useMutation<
    McpConnector,
    Error,
    { id: string; payload: UpdateMcpConnectorPayload }
  >({
    mutationFn: ({ id, payload }) => mcpConnectorService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      // Toggling `status` doesn't change which tools exist, but it does change
      // whether they resolve at runtime. Invalidate tools so consumers reflect
      // the new "available now" set.
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Soft-delete a connector (cascades enabled=false to its tools). */
export function useArchiveMcpConnector() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => mcpConnectorService.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Re-run upstream discovery. */
export function useRefreshMcpConnectorTools() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  return useMutation<RefreshToolsResult, Error, string>({
    mutationFn: (id) => mcpConnectorService.refreshTools(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Begin the OAuth 2.1 connect flow for a connector. The caller opens the
 *  returned `authorizationUrl` in the system browser (or handles the
 *  manual-client signal). No cache invalidation here — tokens land via the
 *  callback round-trip, after which the connectors list refetches. */
export function useStartConnectorOAuth() {
  const { mcpConnectorService } = useServices();
  return useMutation<
    StartOAuthResult,
    Error,
    { id: string; payload: StartOAuthPayload }
  >({
    mutationFn: ({ id, payload }) => mcpConnectorService.startOAuth(id, payload),
  });
}

/** Disconnect an OAuth connector by clearing its stored tokens. After success
 *  the connector's `hasOauthTokens` becomes `false`, transitioning it back to
 *  the "Connect" state so the user can go through the consent flow again.
 *  Invalidates the connectors list and the tools list (disconnected tokens mean
 *  the connector's tools no longer resolve at runtime). */
export function useDisconnectConnectorOAuth() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => mcpConnectorService.disconnectOAuth(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      qc.invalidateQueries({ queryKey: TOOLS_KEY });
    },
  });
}

/** Complete a pre-registered-client (loopback) OAuth connect on the desktop:
 *  authorize → capture on the connector's `callbackPort` → exchange. On a
 *  `connected` result the connector now has stored tokens, so invalidate the
 *  connectors list (→ `hasOauthTokens` refetch) AND the tools list (its tools
 *  resolve at runtime once connected). The `requires_manual_client` result
 *  needs no invalidation (nothing changed). */
export function useConnectorOAuthLoopback() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  return useMutation<
    ConnectViaLoopbackResult,
    Error,
    { id: string; callbackPort: number }
  >({
    mutationFn: ({ id, callbackPort }) =>
      mcpConnectorService.connectViaLoopback(id, callbackPort),
    onSuccess: (result) => {
      if (result.status === 'connected') {
        qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
        qc.invalidateQueries({ queryKey: TOOLS_KEY });
      }
    },
  });
}
