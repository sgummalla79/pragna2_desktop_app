/**
 * One card per registered MCP connector.
 *
 * Header always visible; body toggles in/out. Header shows the connector's
 * identity, transport + auth-type badges, an active/inactive switch, tool
 * counts, and an expand chevron. Body shows the per-tool toggle list, a
 * "Refresh tools" action, and a destructive "Archive" button (gated through
 * `ConfirmButton`).
 *
 * OAuth on desktop: the "Connect" button opens the authorization URL in the
 * system browser via the opener plugin (no in-app navigation). The callback
 * round-trip is not yet wired, so an inline note tells the user to finish in
 * the browser and then Refresh.
 */

import { useMemo, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { ERRORS } from '@/constants/errors';
import {
  useArchiveMcpConnector,
  useRefreshMcpConnectorTools,
  useStartConnectorOAuth,
  useUpdateMcpConnector,
} from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { useTools } from '@/presentation/hooks/tools/useTools';
import { ConnectorToolToggleList } from './ConnectorToolToggleList';
import { EditConnectorModal } from './EditConnectorModal';
import type { McpConnector } from '@/domain/types/mcp.types';

interface Props {
  connector: McpConnector;
}

/** Reads `err.response.data.detail` if present, else the catalog fallback. */
function detailOr(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail;
  return String(detail ?? fallback);
}

/** Expandable card for a single connector with inline manage actions. */
export function ConnectorCard({ connector }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<string | null>(null);
  const [oauthNote, setOauthNote] = useState<string | null>(null);

  const updateConnector = useUpdateMcpConnector();
  const archiveConnector = useArchiveMcpConnector();
  const refreshTools = useRefreshMcpConnectorTools();
  const startOAuth = useStartConnectorOAuth();
  const { data: allTools = [] } = useTools();
  const [editOpen, setEditOpen] = useState(false);

  const isOAuth = connector.authType === 'oauth';
  // Manual-client fallback (AS without dynamic client registration).
  const [manualOpen, setManualOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  async function handleConnect(
    payload: { clientId?: string; clientSecret?: string } = {},
  ) {
    setError(null);
    setOauthNote(null);
    try {
      const result = await startOAuth.mutateAsync({ id: connector.id, payload });
      if (result.requiresManualClient) {
        // The AS has no dynamic client registration — collect a client_id.
        setManualOpen(true);
        return;
      }
      if (result.authorizationUrl) {
        // Desktop: there is no browser navigation. Hand the authorization URL
        // to the system browser via the opener plugin.
        await openUrl(result.authorizationUrl);
        // Callback round-trip not yet wired on desktop — see docs/TODO.md TD-001.
        setOauthNote(
          'Complete the connection in your browser, then Refresh.',
        );
      }
    } catch (err) {
      setError(detailOr(err, ERRORS.CON_006.message));
    }
  }

  const isActive = connector.status === 'active';

  // Filter the flat /api/tools list down to this connector's tools. The
  // backend stamps `mcpConnectorId` on every MCP-typed tool row, so we can
  // do client-side filtering without a per-connector endpoint.
  const connectorTools = useMemo(
    () =>
      allTools
        .filter((t) => t.mcpConnectorId === connector.id)
        .sort((a, b) => a.apiName.localeCompare(b.apiName)),
    [allTools, connector.id],
  );

  const totalCount = connector.tools?.total ?? connectorTools.length;
  const enabledCount =
    connector.tools?.enabled ?? connectorTools.filter((t) => t.enabled).length;

  async function handleToggleActive(nextActive: boolean) {
    setError(null);
    try {
      await updateConnector.mutateAsync({
        id: connector.id,
        payload: { status: nextActive ? 'active' : 'inactive' },
      });
    } catch (err) {
      setError(detailOr(err, ERRORS.CON_003.message));
    }
  }

  async function handleRefreshTools() {
    setError(null);
    setRefreshSummary(null);
    try {
      const diff = await refreshTools.mutateAsync(connector.id);
      setRefreshSummary(
        `Refreshed: ${diff.added} added, ${diff.unchanged} unchanged, ${diff.archived} archived.`,
      );
    } catch (err) {
      setError(detailOr(err, ERRORS.CON_005.message));
    }
  }

  async function handleDeleteConnector() {
    setError(null);
    try {
      await archiveConnector.mutateAsync(connector.id);
    } catch (err) {
      setError(detailOr(err, ERRORS.CON_004.message));
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* ── Header (always visible) — a clickable row (a div, so the inline
          toggle/action buttons can nest without an invalid button-in-button).
          Layout: name · transport · auth · [active/inactive] ⟶ refresh ·
          edit · delete. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        aria-expanded={expanded}
        aria-controls={`mcp-connector-body-${connector.id}`}
        aria-label={connector.displayName}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left"
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
        )}
        <EntityIcon entity="connectors" size="sm" />
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium truncate">{connector.displayName}</span>
            <Badge variant="outline" className="uppercase">
              {connector.transport}
            </Badge>
            <Badge variant="outline" className="uppercase">
              {connector.authType}
            </Badge>
            {/* Active/inactive toggle — sits right after the auth type.
                Active → primary; inactive → destructive token. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleActive(!isActive);
              }}
              disabled={updateConnector.isPending}
              aria-pressed={isActive}
              aria-label={
                isActive
                  ? 'Connector active — click to deactivate'
                  : 'Connector inactive — click to activate'
              }
              title={isActive ? 'Click to deactivate' : 'Click to activate'}
              className={[
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1',
                'text-xs font-semibold transition',
                'disabled:cursor-not-allowed disabled:opacity-60',
                isActive
                  ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                  : 'bg-destructive/15 text-destructive hover:bg-destructive/25',
              ].join(' ')}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-current"
                aria-hidden="true"
              />
              {isActive ? 'Active' : 'Inactive'}
            </button>
            {isOAuth && (
              <Badge variant={connector.hasOauthTokens ? 'default' : 'secondary'}>
                {connector.hasOauthTokens ? 'connected' : 'not connected'}
              </Badge>
            )}
          </div>
          {connector.description && (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {connector.description}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {enabledCount} / {totalCount} tools enabled
          </span>
        </div>

        {/* Right actions — refresh · edit · delete. stopPropagation so they
            don't toggle the row's expand. */}
        <div
          className="flex shrink-0 items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh tools"
            title="Refresh tools"
            onClick={handleRefreshTools}
            disabled={refreshTools.isPending}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={refreshTools.isPending ? 'animate-spin' : undefined}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Edit ${connector.displayName}`}
            title="Edit connector"
            onClick={() => setEditOpen(true)}
          >
            <Pencil size={15} aria-hidden="true" />
          </Button>
          <ConfirmButton
            variant="ghost"
            size="icon"
            aria-label={`Delete ${connector.displayName}`}
            title="Delete connector"
            confirmTitle={`Delete '${connector.displayName}'?`}
            confirmDescription={
              <>
                This permanently deletes the connector and its stored
                credentials, and removes it from every agent and flow that
                references it. This can't be undone.
              </>
            }
            confirmLabel="Delete"
            onConfirm={handleDeleteConnector}
          >
            <Trash2 size={15} aria-hidden="true" />
          </ConfirmButton>
        </div>
      </div>

      {/* ── Expanded body ────────────────────────────────────────── */}
      {expanded && (
        <div
          id={`mcp-connector-body-${connector.id}`}
          className="border-t border-border bg-background"
        >
          {/* OAuth connect section (oauth connectors only) */}
          {isOAuth && (
            <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs">
                  {connector.hasOauthTokens ? (
                    <>
                      <CheckCircle2
                        size={14}
                        aria-hidden="true"
                        className="text-primary"
                      />
                      <span>Connected via OAuth.</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">
                      Not connected. Authorize this connector to use its tools.
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant={connector.hasOauthTokens ? 'outline' : 'default'}
                  onClick={() => handleConnect()}
                  disabled={startOAuth.isPending}
                >
                  {startOAuth.isPending
                    ? 'Starting…'
                    : connector.hasOauthTokens
                      ? 'Reconnect'
                      : 'Connect with OAuth'}
                </Button>
              </div>

              {oauthNote && (
                <p className="text-xs text-muted-foreground">{oauthNote}</p>
              )}

              {manualOpen && (
                <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    This server doesn't support automatic client registration.
                    Enter the OAuth client credentials from the provider.
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`oauth-client-id-${connector.id}`}>
                      Client ID
                    </Label>
                    <Input
                      id={`oauth-client-id-${connector.id}`}
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      placeholder="client_id"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`oauth-client-secret-${connector.id}`}>
                      Client secret{' '}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id={`oauth-client-secret-${connector.id}`}
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      placeholder="client_secret"
                      type="password"
                      autoComplete="off"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      disabled={!clientId.trim() || startOAuth.isPending}
                      onClick={() =>
                        handleConnect({
                          clientId: clientId.trim(),
                          clientSecret: clientSecret || undefined,
                        })
                      }
                    >
                      Connect with these credentials
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {refreshSummary && (
            <div className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              {refreshSummary}
            </div>
          )}
          {error && (
            <div className="border-b border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Tool list */}
          <ConnectorToolToggleList connectorId={connector.id} />
        </div>
      )}

      <EditConnectorModal
        connector={connector}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </Card>
  );
}
