/**
 * MCP connector details form — the connection + authentication editor shared by
 * the Add-connector wizard (create) and the Edit-connector modal (edit).
 *
 * Layout groups fields into two labelled sections — **Connection** (name, URL,
 * description) and **Authentication** (method picker + the selected method's
 * fields) — plus an **Advanced** disclosure for the transport (a smart default,
 * out of the main path since most users never touch it).
 *
 * Authentication maps to the BE `auth_type` discriminator + a generic
 * credential **injection list** (`{ injections: [{ location, name, value }] }`,
 * encrypted at rest):
 *  - **None** — no credentials.
 *  - **API key** — one key as a header OR query param (Tavily-style `?key=…`).
 *  - **Bearer token** — `Authorization: Bearer <token>` header.
 *  - **Custom headers** — an editable header:value list.
 *  - **OAuth 2.1** — no static credentials; the connect flow runs after create.
 *
 * The form owns its field state and assembles a {@link DetailsSubmit} payload;
 * the parent owns the actual create/update mutation. In **edit** mode the URL +
 * transport are read-only (the BE PATCH can't change them — a different URL is a
 * different server), and credential inputs start blank ("leave blank to keep").
 */

import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  readMcpOAuthConfig,
  type ConnectorCredentials,
  type CredentialInjection,
  type InjectionLocation,
  type McpAuthType,
  type McpOAuthConfig,
  type McpTransport,
} from '@/domain/types/mcp.types';
import { MCP_OAUTH_CONFIG_KEY } from '@/constants/mcpOAuth';

/** Initial values for the form (a preset on create, the connector on edit). */
export interface ConnectorDetailsInitial {
  displayName?: string;
  description?: string;
  url?: string;
  transport?: McpTransport;
  authType?: McpAuthType;
  /** Default key name + location for an `api_key` preset. */
  apiKeyName?: string;
  apiKeyLocation?: InjectionLocation;
  /**
   * Pre-registered OAuth app block (generic; `oauth` connectors only).
   * `omitResourceAtTokenExchange` is surfaced as a checkbox in the form's
   * OAuth Advanced section rather than injected silently by the preset.
   */
  oauthConfig?: McpOAuthConfig;
}

/** The assembled payload handed to the parent on submit. The parent maps this
 *  onto the create (`config.url`) or update (`clearCredentials`) request shape. */
export interface DetailsSubmit {
  displayName: string;
  description?: string;
  url: string;
  transport: McpTransport;
  authType: McpAuthType;
  /** Injection-list credentials, or undefined when none were entered. */
  credentials?: ConnectorCredentials;
  /** Edit-only: true when the connector should end up with no static creds
   *  (auth switched to none/oauth) so the parent can wipe stored credentials. */
  clearCredentials: boolean;
  /** Generic pre-registered OAuth app block (`oauth` connectors only, when all
   *  three fields are supplied). Maps to the connector's `config.oauth`. The
   *  create path forwards it; the PATCH (edit) path has no `config` field, so
   *  it is ignored on edit. */
  oauthConfig?: McpOAuthConfig;
}

interface Props {
  mode: 'create' | 'edit';
  initial?: ConnectorDetailsInitial;
  /** Edit mode → true; URL + transport render read-only. */
  urlReadOnly?: boolean;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (payload: DetailsSubmit) => void;
  onCancel: () => void;
  /** Wizard back-to-gallery; omitted in edit mode. */
  onBack?: () => void;
  /** Arms the parent modal's unsaved-changes guard. */
  onDirtyChange?: (dirty: boolean) => void;
}

interface HeaderRow {
  rid: number;
  key: string;
  value: string;
}

/** Form-local auth modes — map 1:1 to the BE `auth_type`. */
type AuthMode = McpAuthType;

const AUTH_OPTIONS: { value: AuthMode; title: string; blurb: string }[] = [
  { value: 'none', title: 'None', blurb: 'Public server' },
  { value: 'api_key', title: 'API key', blurb: 'Header or query param' },
  { value: 'bearer', title: 'Bearer token', blurb: 'Authorization header' },
  { value: 'headers', title: 'Custom headers', blurb: 'One or more headers' },
  { value: 'oauth', title: 'OAuth 2.1', blurb: 'Connect after creating' },
];

const TRANSPORT_LABELS: Record<McpTransport, string> = {
  http: 'HTTP-SSE',
  streamable_http: 'Streamable HTTP',
  // Client-delegated local servers are managed in the Local MCP servers page,
  // not this remote-connector form; included for type completeness.
  stdio: 'Local (stdio)',
};

let _rowSeq = 0;
function newRow(): HeaderRow {
  _rowSeq += 1;
  return { rid: _rowSeq, key: '', value: '' };
}

/** Connection + authentication editor for an MCP connector (create or edit). */
export function ConnectorDetailsForm({
  mode,
  initial,
  urlReadOnly = false,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  onBack,
  onDirtyChange,
}: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [label, setLabel] = useState(initial?.displayName ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [transport, setTransport] = useState<McpTransport>(
    initial?.transport ?? 'http',
  );
  const [authMode, setAuthMode] = useState<AuthMode>(initial?.authType ?? 'none');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [apiKeyLocation, setApiKeyLocation] = useState<InjectionLocation>(
    initial?.apiKeyLocation ?? 'header',
  );
  const [apiKeyName, setApiKeyName] = useState(initial?.apiKeyName ?? '');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [headers, setHeaders] = useState<HeaderRow[]>([newRow()]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Generic pre-registered OAuth app block (config.oauth) — shown for `oauth`
  // connectors whose AS uses a pre-registered client + a fixed loopback
  // redirect (no Dynamic Client Registration). Product-agnostic: just three
  // plain fields, no server-specific defaults.
  const [oauthClientId, setOauthClientId] = useState(
    initial?.oauthConfig?.clientId ?? '',
  );
  const [oauthLoginUrl, setOauthLoginUrl] = useState(
    initial?.oauthConfig?.loginUrl ?? '',
  );
  const [oauthCallbackPort, setOauthCallbackPort] = useState(
    initial?.oauthConfig ? String(initial.oauthConfig.callbackPort) : '',
  );
  const [oauthOmitResource, setOauthOmitResource] = useState(
    initial?.oauthConfig?.omitResourceAtTokenExchange === true,
  );
  // Auto-expand the OAuth advanced section when the preset pre-fills any field
  // (including omitResourceAtTokenExchange) so preset-users see what was set.
  const [oauthAdvancedOpen, setOauthAdvancedOpen] = useState(
    initial?.oauthConfig != null,
  );

  const isEdit = mode === 'edit';

  // Trim-aware so whitespace-only edits don't trip the unsaved-changes guard.
  const isDirty =
    label.trim() !== (initial?.displayName ?? '').trim() ||
    url.trim() !== (initial?.url ?? '').trim() ||
    description.trim() !== (initial?.description ?? '').trim() ||
    authMode !== (initial?.authType ?? 'none') ||
    token.length > 0 ||
    apiKeyValue.length > 0 ||
    headers.some((r) => r.key.trim().length > 0 || r.value.length > 0) ||
    oauthClientId.trim() !== (initial?.oauthConfig?.clientId ?? '').trim() ||
    oauthLoginUrl.trim() !== (initial?.oauthConfig?.loginUrl ?? '').trim() ||
    oauthCallbackPort.trim() !==
      (initial?.oauthConfig ? String(initial.oauthConfig.callbackPort) : '') ||
    oauthOmitResource !== (initial?.oauthConfig?.omitResourceAtTokenExchange === true);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  function addHeaderRow() {
    setHeaders((h) => [...h, newRow()]);
  }
  function updateHeaderRow(rid: number, patch: Partial<HeaderRow>) {
    setHeaders((h) => h.map((r) => (r.rid === rid ? { ...r, ...patch } : r)));
  }
  function removeHeaderRow(rid: number) {
    setHeaders((h) =>
      h.length === 1 ? [newRow()] : h.filter((r) => r.rid !== rid),
    );
  }

  function selectAuth(mode: AuthMode) {
    setAuthMode(mode);
    // OAuth-era servers use Streamable HTTP — preselect it (still overridable
    // under Advanced).
    if (mode === 'oauth') setTransport('streamable_http');
  }

  /** Collapse the chosen auth mode into the BE `credentials` injection list. */
  function buildCredentials(): ConnectorCredentials | undefined {
    const injections: CredentialInjection[] = [];
    if (authMode === 'bearer') {
      const t = token.trim();
      if (t) {
        injections.push({
          location: 'header',
          name: 'Authorization',
          value: `Bearer ${t}`,
        });
      }
    } else if (authMode === 'api_key') {
      const name = apiKeyName.trim();
      if (name && apiKeyValue !== '') {
        injections.push({ location: apiKeyLocation, name, value: apiKeyValue });
      }
    } else if (authMode === 'headers') {
      for (const r of headers) {
        const k = r.key.trim();
        if (k && r.value !== '') {
          injections.push({ location: 'header', name: k, value: r.value });
        }
      }
    }
    return injections.length > 0 ? { injections } : undefined;
  }

  /**
   * Assemble the optional pre-registered OAuth block (`config.oauth`).
   *
   * Returns `{ config }` with a validated block when all three fields are
   * present + valid; `{ config: undefined }` when none are entered (a plain DCR
   * oauth connector); or `{ error }` when the block is partially / invalidly
   * filled — surfaced explicitly rather than silently dropped.
   */
  function buildOAuthConfig():
    | { config?: McpOAuthConfig; error?: undefined }
    | { error: string; config?: undefined } {
    if (authMode !== 'oauth') return { config: undefined };
    const clientId = oauthClientId.trim();
    const loginUrl = oauthLoginUrl.trim();
    const portStr = oauthCallbackPort.trim();
    const anyFilled = clientId !== '' || loginUrl !== '' || portStr !== '';
    if (!anyFilled) return { config: undefined };

    // Reuse the domain reader so the form and the runtime decision validate the
    // block identically (DRY). Include omitResourceAtTokenExchange only when
    // the user has checked the box (omit the key entirely when false).
    const candidate = readMcpOAuthConfig({
      [MCP_OAUTH_CONFIG_KEY]: {
        clientId,
        loginUrl,
        callbackPort: Number(portStr),
        ...(oauthOmitResource ? { omitResourceAtTokenExchange: true } : {}),
      },
    });
    if (!candidate) {
      return {
        error:
          'Complete all three pre-registered OAuth fields (Client ID, Login URL, and a valid Callback port), or clear them all.',
      };
    }
    return { config: candidate };
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const trimmedLabel = label.trim();
    const trimmedUrl = url.trim();
    if (!trimmedLabel) {
      setLocalError('Name is required.');
      return;
    }
    if (!trimmedUrl) {
      setLocalError('Server URL is required.');
      return;
    }

    const oauth = buildOAuthConfig();
    if (oauth.error) {
      setLocalError(oauth.error);
      return;
    }

    onSubmit({
      displayName: trimmedLabel,
      description: description.trim() || undefined,
      url: trimmedUrl,
      transport,
      authType: authMode,
      credentials: buildCredentials(),
      // No static credentials for none/oauth — let an edit wipe any stale blob.
      clearCredentials: authMode === 'none' || authMode === 'oauth',
      oauthConfig: oauth.config,
    });
  }

  const shownError = error ?? localError;
  const credHint = isEdit
    ? 'Leave blank to keep the current credentials.'
    : 'Sent on every call to the connector. Stored encrypted at rest.';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* ── Connection ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Connection
        </h3>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mcp-label">Name</Label>
          <Input
            id="mcp-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Tavily Search"
            autoFocus
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mcp-url">Server URL</Label>
          <Input
            id="mcp-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mcp.example.com"
            readOnly={urlReadOnly}
            aria-readonly={urlReadOnly}
            className={urlReadOnly ? 'cursor-not-allowed opacity-60' : undefined}
            required
          />
          <p className="text-xs text-muted-foreground">
            {urlReadOnly
              ? "URL can't be changed — re-add the connector to point at a different server."
              : 'Only connect to MCP servers you trust and verify.'}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="mcp-description">
            Description <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="mcp-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Web search for my agents"
          />
        </div>
      </section>

      {/* ── Authentication ─────────────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Authentication
        </h3>

        <Select value={authMode} onValueChange={(v) => selectAuth(v as AuthMode)}>
          <SelectTrigger
            className="w-full"
            aria-label="Authentication method"
            data-testid="auth-method-select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUTH_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Selected method's fields */}
        {authMode === 'oauth' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              You'll connect with OAuth after creating the connector — use the
              Connect button.
            </p>

            {/* Optional pre-registered OAuth app (generic — for servers whose
                authorization server uses a pre-registered client + a fixed
                loopback redirect instead of automatic client registration). */}
            <button
              type="button"
              onClick={() => setOauthAdvancedOpen((v) => !v)}
              className="-mx-2 flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
              aria-expanded={oauthAdvancedOpen}
            >
              <ChevronRight
                size={14}
                aria-hidden="true"
                className={`transition-transform ${oauthAdvancedOpen ? 'rotate-90' : ''}`}
              />
              Pre-registered OAuth app
              <span className="font-normal text-muted-foreground">
                · optional
              </span>
            </button>

            {oauthAdvancedOpen && (
              <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  For servers that use a pre-registered OAuth client with a fixed
                  loopback redirect (no automatic client registration). Leave
                  blank for servers that register a client automatically.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mcp-oauth-client-id">Client ID</Label>
                  <Input
                    id="mcp-oauth-client-id"
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder="client_id"
                    autoComplete="off"
                    data-testid="mcp-oauth-client-id"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mcp-oauth-login-url">Login URL</Label>
                  <Input
                    id="mcp-oauth-login-url"
                    type="url"
                    value={oauthLoginUrl}
                    onChange={(e) => setOauthLoginUrl(e.target.value)}
                    placeholder="https://login.example.com"
                    autoComplete="off"
                    data-testid="mcp-oauth-login-url"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mcp-oauth-callback-port">Callback port</Label>
                  <Input
                    id="mcp-oauth-callback-port"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={65535}
                    value={oauthCallbackPort}
                    onChange={(e) => setOauthCallbackPort(e.target.value)}
                    placeholder="8082"
                    autoComplete="off"
                    data-testid="mcp-oauth-callback-port"
                  />
                  <p className="text-xs text-muted-foreground">
                    The local port the authorization server redirects to
                    (http://localhost:&#123;port&#125;/callback).
                  </p>
                </div>

                {/* Token-exchange quirk: some AS (e.g. Salesforce) reject the
                    RFC 8707 resource param at /token and return invalid_grant.
                    Tracker #136 / #137. */}
                <label className="flex cursor-pointer items-start gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    checked={oauthOmitResource}
                    onChange={(e) => setOauthOmitResource(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                    data-testid="mcp-oauth-omit-resource"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium leading-none">
                      Omit resource parameter at token exchange
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Enable for authorization servers (e.g. Salesforce) that
                      reject the RFC&nbsp;8707 <code>resource</code> parameter
                      at the token endpoint.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        )}

        {authMode === 'bearer' && (
          <div className="relative">
            <KeyRound
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="mcp-token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={isEdit ? 'Enter a new token' : 'Add your access token'}
              type={showToken ? 'text' : 'password'}
              autoComplete="off"
              className="px-8"
            />
            <button
              type="button"
              onClick={() => setShowToken((s) => !s)}
              aria-label={showToken ? 'Hide token' : 'Show token'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? (
                <EyeOff size={14} aria-hidden="true" />
              ) : (
                <Eye size={14} aria-hidden="true" />
              )}
            </button>
          </div>
        )}

        {authMode === 'api_key' && (
          <div className="flex flex-col gap-2">
            <Select
              value={apiKeyLocation}
              onValueChange={(v) => setApiKeyLocation(v as InjectionLocation)}
            >
              <SelectTrigger className="w-full" data-testid="mcp-apikey-location">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Send as header</SelectItem>
                <SelectItem value="query_param">
                  Send as query parameter
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Input
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder={apiKeyLocation === 'header' ? 'X-API-Key' : 'api_key'}
                className="flex-1"
                aria-label="API key name"
              />
              <span className="text-muted-foreground">:</span>
              <Input
                value={apiKeyValue}
                onChange={(e) => setApiKeyValue(e.target.value)}
                placeholder="value"
                type="password"
                autoComplete="off"
                className="flex-1"
                aria-label="API key value"
              />
            </div>
          </div>
        )}

        {authMode === 'headers' && (
          <div className="flex flex-col gap-2">
            {headers.map((r) => (
              <div key={r.rid} className="flex items-center gap-2">
                <Input
                  value={r.key}
                  onChange={(e) => updateHeaderRow(r.rid, { key: e.target.value })}
                  placeholder="header"
                  className="flex-1"
                />
                <span className="text-muted-foreground">:</span>
                <Input
                  value={r.value}
                  onChange={(e) =>
                    updateHeaderRow(r.rid, { value: e.target.value })
                  }
                  placeholder="value"
                  type="password"
                  autoComplete="off"
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeHeaderRow(r.rid)}
                  aria-label="Remove header"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <Minus size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addHeaderRow}
              className="inline-flex items-center gap-1.5 self-start rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Plus size={14} aria-hidden="true" />
              Add header
            </button>
          </div>
        )}

        {authMode !== 'none' && (
          <p className="text-xs text-muted-foreground">{credHint}</p>
        )}
      </section>

      {/* ── Advanced (transport) ───────────────────────────────────── */}
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="-mx-2 flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-xs font-medium text-foreground transition hover:bg-muted"
          aria-expanded={advancedOpen}
        >
          <ChevronRight
            size={14}
            aria-hidden="true"
            className={`transition-transform ${advancedOpen ? 'rotate-90' : ''}`}
          />
          Advanced
          <span className="font-normal text-muted-foreground">
            · Transport: {TRANSPORT_LABELS[transport]}
          </span>
        </button>

        {advancedOpen && (
          <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/20 p-3">
            <Label htmlFor="mcp-transport">Transport</Label>
            <Select
              value={transport}
              onValueChange={(v) => setTransport(v as McpTransport)}
              disabled={urlReadOnly}
            >
              <SelectTrigger
                id="mcp-transport"
                className="w-full"
                data-testid="mcp-transport"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="http">HTTP-SSE</SelectItem>
                <SelectItem value="streamable_http">Streamable HTTP</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {urlReadOnly
                ? "Transport can't be changed after creating the connector."
                : 'Use Streamable HTTP for modern (incl. OAuth) servers; HTTP-SSE for older ones.'}
            </p>
          </div>
        )}
      </section>

      {shownError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {shownError}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            <ArrowLeft size={14} aria-hidden="true" className="mr-1" />
            Back
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
