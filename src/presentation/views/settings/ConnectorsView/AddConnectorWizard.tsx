/**
 * Add-connector wizard — a three-panel modal flow:
 *
 *   ① Gallery   — pick a well-known server from {@link CONNECTOR_PRESETS} (which
 *                 pre-fills the next step) or choose "Custom server".
 *   ② Details   — the {@link ConnectorDetailsForm}; submit creates the connector
 *                 and discovers its tools.
 *   ③ Tools     — static-auth connectors: toggle the discovered tools on.
 *                 OAuth connectors: a "Connect with OAuth" CTA that opens the
 *                 authorization URL in the system browser.
 *
 * The dirty-guard arms only on step ② with unsaved field edits (protects a
 * typed token).
 */

import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Plus } from 'lucide-react';

import { ConnectorsIcon } from '@/presentation/components/icons/ConnectorsIcon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ERRORS } from '@/constants/errors';
import { useDirtyDialog } from '@/presentation/hooks/useDirtyDialog';
import {
  useConnectorOAuthLoopback,
  useRegisterMcpConnector,
  useStartConnectorOAuth,
} from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { MCP_OAUTH_CONFIG_KEY } from '@/constants/mcpOAuth';
import { resolveOAuthConnectMode } from './oauthConnectMode';
import {
  CONNECTOR_PRESETS,
  faviconUrl,
  simpleIconUrl,
  type ConnectorPreset,
} from './connectorPresets';
import {
  ConnectorDetailsForm,
  type ConnectorDetailsInitial,
  type DetailsSubmit,
} from './ConnectorDetailsForm';
import { ConnectorToolToggleList } from './ConnectorToolToggleList';
import type { RegisteredMcpConnector } from '@/domain/types/mcp.types';

type Step = 'gallery' | 'details' | 'tools';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called once, as soon as a connector is successfully registered (before the
   * tools/OAuth step). Lets a caller (e.g. the flow editor's ConnectorPanel)
   * attach the new connector to a node inline while the wizard stays open for
   * tool-enabling. Omitted on the standalone Settings → Connectors usage.
   */
  onRegistered?: (connector: RegisteredMcpConnector) => void;
}

/** Brand icon for a preset tile: the service favicon, monogram on load error. */
function PresetIcon({ preset }: { preset: ConnectorPreset }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white ${preset.accent}`}
        aria-hidden="true"
      >
        {preset.monogram}
      </span>
    );
  }
  // Prefer the Simple Icons slug when set (the favicon is wrong/generic for
  // some brands — e.g. Google products share one domain favicon).
  const src = preset.iconSlug
    ? simpleIconUrl(preset.iconSlug)
    : faviconUrl(preset.iconDomain);
  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
}

/** Three-step modal that creates a connector and opts its tools in. */
export function AddConnectorWizard({ open, onOpenChange, onRegistered }: Props) {
  const [step, setStep] = useState<Step>('gallery');
  const [preset, setPreset] = useState<ConnectorPreset | null>(null);
  const [created, setCreated] = useState<RegisteredMcpConnector | null>(null);
  const [search, setSearch] = useState('');
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthNote, setOauthNote] = useState<string | null>(null);

  const register = useRegisterMcpConnector();
  const startOAuth = useStartConnectorOAuth();
  const loopbackConnect = useConnectorOAuthLoopback();

  // Guard Escape / overlay-click only while details fields are unsaved.
  const guard = useDirtyDialog(open && step === 'details' && detailsDirty);

  // Reset the flow whenever the modal closes so reopening starts at the gallery.
  useEffect(() => {
    if (!open) {
      setStep('gallery');
      setPreset(null);
      setCreated(null);
      setSearch('');
      setDetailsDirty(false);
      setError(null);
      setOauthNote(null);
    }
  }, [open]);

  const filteredPresets = CONNECTOR_PRESETS.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) || p.blurb.toLowerCase().includes(q)
    );
  });

  function pickPreset(p: ConnectorPreset | null) {
    setPreset(p);
    setError(null);
    setStep('details');
  }

  const detailsInitial: ConnectorDetailsInitial | undefined = preset
    ? {
        displayName: preset.name,
        url: preset.url,
        transport: preset.transport,
        authType: preset.authType,
        apiKeyName: preset.apiKeyName,
        apiKeyLocation: preset.apiKeyLocation,
      }
    : undefined;

  async function handleDetailsSubmit(p: DetailsSubmit) {
    setError(null);
    try {
      const result = await register.mutateAsync({
        displayName: p.displayName,
        description: p.description,
        transport: p.transport,
        config: {
          url: p.url,
          // Forward the optional generic pre-registered OAuth block, when set.
          ...(p.oauthConfig ? { [MCP_OAUTH_CONFIG_KEY]: p.oauthConfig } : {}),
        },
        authType: p.authType,
        credentials: p.credentials,
      });
      setCreated(result);
      setDetailsDirty(false);
      // Let an inline caller (flow editor) attach the new connector immediately;
      // the wizard stays open for tool-enabling / OAuth.
      onRegistered?.(result);
      setStep('tools');
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? ERRORS.CON_002.message;
      setError(String(detail));
    }
  }

  async function handleOAuthConnect() {
    if (!created) return;
    setError(null);
    setOauthNote(null);
    try {
      // Pre-registered loopback connectors (config.oauth.callbackPort) complete
      // end-to-end on the desktop: capture the redirect locally + exchange.
      const connectMode = resolveOAuthConnectMode(created.config);
      if (connectMode.mode === 'loopback') {
        const result = await loopbackConnect.mutateAsync({
          id: created.id,
          callbackPort: connectMode.callbackPort,
        });
        if (result.status === 'requires_manual_client') {
          setError(
            "This server needs OAuth client credentials. Close this and use the connector card's Connect button to enter them.",
          );
          return;
        }
        setOauthNote('Connected. Manage its tools from the connector list.');
        return;
      }

      const result = await startOAuth.mutateAsync({ id: created.id, payload: {} });
      if (result.requiresManualClient) {
        // The card's Connect section handles the manual-client fallback — send
        // the user there to finish.
        setError(
          "This server needs OAuth client credentials. Close this and use the connector card's Connect button to enter them.",
        );
        return;
      }
      if (result.authorizationUrl) {
        // Desktop browser-redirect path (no callbackPort): open the auth URL in
        // the system browser; the BE's server-side callback finishes it.
        await openUrl(result.authorizationUrl);
        setOauthNote('Complete the connection in your browser, then Refresh.');
      }
    } catch (err) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? ERRORS.CON_006.message;
      setError(String(detail));
    }
  }

  const title =
    step === 'gallery'
      ? 'Add a connector'
      : step === 'details'
        ? preset
          ? `Connect to ${preset.name}`
          : 'Custom server'
        : 'Connector ready';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[700] bg-foreground/40 backdrop-blur-sm" />
        <Dialog.Content
          className="
            fixed left-1/2 top-1/2 z-[701] -translate-x-1/2 -translate-y-1/2
            w-[640px] max-w-[calc(100vw-32px)]
            flex flex-col gap-3
            rounded-xl border border-border
            bg-popover p-5 shadow-2xl
            max-h-[90vh] overflow-y-auto
          "
          {...guard.contentProps}
        >
          {/* Header: icon tile + step title (the dialog's a11y title is shown). */}
          <div className="flex flex-col items-center gap-1.5 pb-0">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500 text-white">
              <ConnectorsIcon size={22} aria-hidden="true" />
            </span>
            <Dialog.Title className="text-base font-semibold">
              {title}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Add a remote MCP server to discover and use its tools.
            </Dialog.Description>
          </div>

          {/* ── ① Gallery ──────────────────────────────────────────── */}
          {step === 'gallery' && (
            <div className="flex flex-col gap-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search servers…"
                aria-label="Search servers"
                autoFocus
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`connector-preset-${p.id}`}
                    onClick={() => pickPreset(p)}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition hover:bg-muted"
                  >
                    <PresetIcon preset={p} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {p.blurb}
                      </span>
                    </span>
                  </button>
                ))}

                {/* Custom server tile */}
                <button
                  type="button"
                  data-testid="connector-preset-custom"
                  onClick={() => pickPreset(null)}
                  className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3 text-left text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-border">
                    <Plus size={16} aria-hidden="true" />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      Custom server
                    </span>
                    <span className="text-xs">Enter a URL manually</span>
                  </span>
                </button>
              </div>
              {filteredPresets.length === 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  No matching servers. Use “Custom server” to add one manually.
                </p>
              )}
            </div>
          )}

          {/* ── ② Details ──────────────────────────────────────────── */}
          {step === 'details' && (
            <ConnectorDetailsForm
              mode="create"
              initial={detailsInitial}
              submitting={register.isPending}
              error={error}
              submitLabel="Connect + discover tools"
              onSubmit={handleDetailsSubmit}
              onCancel={() => onOpenChange(false)}
              onBack={() => setStep('gallery')}
              onDirtyChange={setDetailsDirty}
            />
          )}

          {/* ── ③ Tools / connect ──────────────────────────────────── */}
          {step === 'tools' && created && (
            <div className="flex flex-col gap-3">
              {created.authType === 'oauth' ? (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <p className="text-sm">
                    <span className="font-medium">{created.displayName}</span> was
                    created. Connect it with OAuth to discover and use its tools.
                  </p>
                  {error && <p className="text-xs text-destructive">{error}</p>}
                  {oauthNote && (
                    <p className="text-xs text-muted-foreground">{oauthNote}</p>
                  )}
                  <Button
                    onClick={handleOAuthConnect}
                    disabled={startOAuth.isPending || loopbackConnect.isPending}
                  >
                    {startOAuth.isPending || loopbackConnect.isPending
                      ? 'Starting…'
                      : 'Connect with OAuth'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    I'll connect later
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm">
                    Discovered{' '}
                    <span className="font-medium">
                      {created.discoveredToolApiNames.length}
                    </span>{' '}
                    tool
                    {created.discoveredToolApiNames.length === 1 ? '' : 's'}. Toggle
                    on the ones you want available to your agents.
                  </p>
                  <div className="rounded-lg border border-border">
                    <ConnectorToolToggleList
                      connectorId={created.id}
                      emptyHint="No tools discovered — this server may not expose any."
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button onClick={() => onOpenChange(false)}>Done</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
