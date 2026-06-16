import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  KeyRound,
  Loader2,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';


import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import type {
  LocalServersConfig,
  McpConnector,
  StdioServerConfig,
} from '@/domain/types/mcp.types';
import { extractErrorMessage } from '@/infrastructure/errors/extractErrorMessage';
import { logger } from '@/infrastructure/logging/logger';
import { mcpStdio, NotInTauriError, usesWindowsChrome } from '@/infrastructure/platform';
import { validateAndFormatMcpConfig } from './validateMcpConfig';
import {
  MCP_CONNECTORS_KEY,
  useMcpConnectors,
} from '@/presentation/hooks/mcp-connectors/useMcpConnectors';
import { useServices } from '@/presentation/providers/ServiceContext';

const EMPTY_CONFIG = '{\n  "mcpServers": {}\n}';

/** Pretty-printed sample shown beneath the editor as authoring guidance. */
const EXAMPLE_CONFIG = JSON.stringify(
  {
    mcpServers: {
      files: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/path'],
        env: {},
      },
    },
  },
  null,
  2,
);

/**
 * Local MCP servers (Phase F) — Claude-Desktop-style config editor for
 * CLIENT-DELEGATED stdio servers. Saving discovers each server's tools locally
 * (Rust), registers identity + schemas with the backend, and stores the launch
 * config (incl. env secrets) in the OS keychain. The hosted agent then delegates
 * stdio tool calls back to this desktop.
 */
export default function LocalServersView() {
  const { mcpConnectorService } = useServices();
  const qc = useQueryClient();
  const { data: connectors } = useMcpConnectors();
  // On Windows with the custom title bar (h-8 = 32px, z-[200]), the Sheet must
  // start below the title bar to avoid overlapping the min/max/close buttons.
  const windowsChrome = usesWindowsChrome();

  const localServers = useMemo<McpConnector[]>(
    () => (connectors ?? []).filter((c) => c.transport === 'stdio'),
    [connectors],
  );

  const [editorText, setEditorText] = useState(EMPTY_CONFIG);
  const [saving, setSaving] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  /** True when save failed — show Authenticate button in the Sheet if a command is available. */
  const [saveFailedAuth, setSaveFailedAuth] = useState(false);
  /** connector id currently running auth from the card list, or null. */
  const [authenticatingId, setAuthenticatingId] = useState<string | null>(null);
  /** Per-connector auth result shown below the list. */
  const [authResult, setAuthResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null);
  // Whether the slide-in config editor panel is open.
  const [panelOpen, setPanelOpen] = useState(false);
  // Whether the "Example config" accordion is expanded.
  const [exampleOpen, setExampleOpen] = useState(false);

  /** Map of connector displayName → launch command, derived from the editor text.
   *  Used to supply the right binary to mcpStdio.auth() per card. */
  const commandByName = useMemo<Map<string, string>>(() => {
    try {
      const parsed = JSON.parse(editorText) as LocalServersConfig;
      return new Map(
        Object.entries(parsed.mcpServers).map(([name, cfg]) => [name, cfg.command]),
      );
    } catch {
      return new Map();
    }
  }, [editorText]);

  /** The command of the first server in the editor text — used by the Sheet-level
   *  Authenticate button that appears after a save error. */
  const firstCommand = useMemo<string | null>(() => {
    try {
      const parsed = JSON.parse(editorText) as LocalServersConfig;
      return Object.values(parsed.mcpServers)[0]?.command ?? null;
    } catch {
      return null;
    }
  }, [editorText]);

  // Load the authored config blob from the keychain (the editing source of
  // truth). Falls back to an empty template the first time.
  useEffect(() => {
    void mcpStdio.loadEditorConfig().then((blob) => {
      if (blob) setEditorText(blob);
    });
  }, []);

  const handleSave = useCallback(async (isRetry = false) => {
    setError(null);
    setSaveFailedAuth(false);

    const validation = validateAndFormatMcpConfig(editorText);
    if (!validation.ok) {
      setFormatError(validation.error);
      return;
    }
    // Apply the formatted version so the textarea stays clean after save.
    const canonical = validation.formatted;
    if (canonical !== editorText) setEditorText(canonical);
    const parsed = JSON.parse(canonical) as LocalServersConfig;

    const entries = Object.entries(parsed.mcpServers);

    // Consent (spec MUST): show the full commands before the first spawn.
    // Skipped on auto-retry after sign-in — user already approved these commands.
    if (entries.length > 0 && !isRetry) {
      const lines = entries
        .map(([name, c]) => `• ${name}: ${c.command} ${(c.args ?? []).join(' ')}`)
        .join('\n');
      const ok = window.confirm(
        `These local commands will run on your machine:\n\n${lines}\n\n` +
          'Local MCP servers run with your privileges — only add servers you ' +
          'trust. Continue?',
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const existingByName = new Map(localServers.map((c) => [c.displayName, c]));
      const configNames = new Set(entries.map(([n]) => n));

      // Add / update each server in the config.
      for (const [name, raw] of entries) {
        const cfg: StdioServerConfig = {
          command: raw.command,
          args: raw.args ?? [],
          env: raw.env ?? {},
        };
        const tools = await mcpStdio.discover(cfg);
        const current = existingByName.get(name);
        if (current) {
          await mcpConnectorService.syncTools(current.id, tools);
          await mcpStdio.saveConfig(current.id, cfg);
        } else {
          const registered = await mcpConnectorService.registerClientDelegated({
            displayName: name,
            tools,
          });
          await mcpStdio.saveConfig(registered.id, cfg);
        }
      }

      // Remove servers no longer in the config.
      for (const c of localServers) {
        if (!configNames.has(c.displayName)) {
          await mcpConnectorService.archive(c.id);
          await mcpStdio.clearConfig(c.id);
        }
      }

      await mcpStdio.saveEditorConfig(editorText);
      await qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      await qc.invalidateQueries({ queryKey: ['tools'] });
      toast.success(`Saved — ${entries.length} local server(s) configured.`);
      setPanelOpen(false);
    } catch (e) {
      if (e instanceof NotInTauriError) {
        setError('Local MCP servers are only available in the desktop app.');
      } else {
        // CF-014: Tauri invoke() rejects with a plain string, not an Error.
        const msg = extractErrorMessage(e, 'Failed to save local servers.');
        setError(msg);
        logger.fromError('LSV_001:save', e instanceof Error ? e : new Error(msg));
        // Show Authenticate button in the Sheet when a command is available —
        // no sentinel matching needed; any save failure can be auth-related.
        if (firstCommand) setSaveFailedAuth(true);
      }
    } finally {
      setSaving(false);
    }
  }, [editorText, localServers, mcpConnectorService, qc]);

  const handleRemove = useCallback(
    async (c: McpConnector) => {
      if (!window.confirm(`Remove local server "${c.displayName}"?`)) return;
      setError(null);
      try {
        await mcpConnectorService.archive(c.id);
        await mcpStdio.clearConfig(c.id);
        await qc.invalidateQueries({ queryKey: MCP_CONNECTORS_KEY });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to remove server.');
      }
    },
    [mcpConnectorService, qc],
  );

  /** Validate + auto-format the editor text on blur or paste. */
  const handleBlurOrPaste = useCallback((text: string) => {
    const result = validateAndFormatMcpConfig(text);
    if (result.ok) {
      setFormatError(null);
      setEditorText(result.formatted);
    } else {
      setFormatError(result.error);
    }
  }, []);

  /** Auth from inside the Sheet after a save error, then auto-retry save. */
  const handleSheetSignIn = useCallback(async () => {
    if (!firstCommand) return;
    setSigningIn(true);
    setError(null);
    // Keep saveFailedAuth=true while in-flight so the button stays visible.
    try {
      await mcpStdio.auth(firstCommand);
      setSaveFailedAuth(false);
      await handleSave(true);
    } catch (e) {
      const msg = extractErrorMessage(e, 'Authentication failed.');
      setError(msg);
      logger.fromError('LSV_003:sheet-auth', e instanceof Error ? e : new Error(msg));
    } finally {
      setSigningIn(false);
    }
  }, [firstCommand, handleSave]);

  /** Run the mcp-adaptor OAuth browser flow for a specific server's binary. */
  const handleAuthenticate = useCallback(async (connector: McpConnector) => {
    const command = commandByName.get(connector.displayName);
    if (!command) return;
    setAuthenticatingId(connector.id);
    setAuthResult(null);
    try {
      await mcpStdio.auth(command);
      toast.success(`${connector.displayName} authenticated.`);
      setAuthResult({ id: connector.id, ok: true, msg: 'Authenticated successfully.' });
    } catch (e) {
      const msg = extractErrorMessage(e, 'Authentication failed.');
      setAuthResult({ id: connector.id, ok: false, msg });
      logger.fromError('LSV_002:auth', e instanceof Error ? e : new Error(msg));
    } finally {
      setAuthenticatingId(null);
    }
  }, [commandByName]);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <header className="mb-6 flex items-start gap-3">
        <EntityIcon entity="developer" size="lg" className="mt-1 shrink-0" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Developer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run MCP servers on this machine. They&rsquo;re discovered locally and
            delegated to from your chats — secrets in <code>env</code> stay in your
            OS keychain and never reach the server.
          </p>
        </div>
      </header>

      {/* Example config (collapsible) — sits above the Configured servers list.
          Mirrors the expandable connector card pattern (controlled state, a
          clickable header row, chevron, and a conditional bordered body). */}
      <Card className="mb-6 overflow-hidden p-0">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setExampleOpen((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setExampleOpen((v) => !v);
            }
          }}
          aria-expanded={exampleOpen}
          aria-controls="local-servers-example-body"
          aria-label="Example config"
          className="flex w-full cursor-pointer items-center gap-3 p-4 text-left text-sm font-medium text-foreground"
        >
          {exampleOpen ? (
            <ChevronDown size={16} aria-hidden="true" className="shrink-0" />
          ) : (
            <ChevronRight size={16} aria-hidden="true" className="shrink-0" />
          )}
          <span className="flex-1">Example config</span>
        </div>
        {exampleOpen && (
          <div
            id="local-servers-example-body"
            className="border-t border-border bg-background px-4 py-3"
          >
            <pre className="overflow-x-auto rounded-md bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              <code>{EXAMPLE_CONFIG}</code>
            </pre>
          </div>
        )}
      </Card>

      {/* Configured servers */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">
            Configured servers
          </h2>
          <Button
            size="sm"
            className="shrink-0"
            onClick={() => {
              setError(null);
              setPanelOpen(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden />
            Edit Config
          </Button>
        </div>
        {localServers.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No servers added yet. Use Edit Config to add one.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {localServers.map((c) => {
              const hasCommand = commandByName.has(c.displayName);
              const isAuthenticating = authenticatingId === c.id;
              const result = authResult?.id === c.id ? authResult : null;
              return (
                <li
                  key={c.id}
                  className="flex flex-col gap-1 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.displayName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.tools
                          ? `${c.tools.enabled}/${c.tools.total} tools enabled`
                          : 'stdio'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {hasCommand && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleAuthenticate(c)}
                          disabled={isAuthenticating}
                          aria-label={`Authenticate ${c.displayName}`}
                        >
                          {isAuthenticating ? (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden />
                          ) : (
                            <KeyRound className="mr-2 h-3 w-3" aria-hidden />
                          )}
                          {isAuthenticating ? 'Authenticating…' : 'Authenticate'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleRemove(c)}
                        aria-label={`Remove ${c.displayName}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  {result && (
                    <p
                      role="status"
                      className={`rounded px-2 py-1 text-xs ${
                        result.ok
                          ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {result.msg}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Slide-in config editor */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent className={`sm:max-w-xl${windowsChrome ? ' !top-8' : ''}`}>
          <SheetHeader>
            <SheetTitle>Edit config</SheetTitle>
            <SheetDescription>
              Define local MCP servers as JSON. Saving discovers each
              server&rsquo;s tools and stores its launch config in your OS
              keychain.
            </SheetDescription>
          </SheetHeader>

          <textarea
            value={editorText}
            onChange={(e) => {
              setEditorText(e.target.value);
              setFormatError(null);
            }}
            onBlur={(e) => handleBlurOrPaste(e.target.value)}
            onPaste={(e) => {
              // Read the pasted text from the clipboard data and validate after
              // the browser has merged it into the textarea value (one tick later).
              const pasted = e.clipboardData.getData('text');
              // Reconstruct what the textarea will look like after the paste.
              const el = e.currentTarget;
              const next =
                el.value.slice(0, el.selectionStart ?? 0) +
                pasted +
                el.value.slice(el.selectionEnd ?? 0);
              // Defer so the DOM value is already updated when we read it.
              setTimeout(() => handleBlurOrPaste(next), 0);
            }}
            spellCheck={false}
            className={[
              'min-h-0 w-full flex-1 resize-none rounded-md border bg-background px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              formatError ? 'border-destructive' : 'border-border',
            ].join(' ')}
            aria-label="Local MCP servers config (JSON)"
            aria-describedby={formatError ? 'mcp-config-format-error' : undefined}
          />

          {formatError && (
            <p
              id="mcp-config-format-error"
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formatError}
            </p>
          )}

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {saveFailedAuth && firstCommand && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSheetSignIn()}
              disabled={signingIn}
              aria-label="Authenticate with MCP gateway"
            >
              {signingIn ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" aria-hidden />
              )}
              {signingIn ? 'Authenticating…' : 'Authenticate'}
            </Button>
          )}

          <SheetFooter>
            <Button onClick={() => void handleSave()} disabled={saving || !!formatError}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="mr-2 h-4 w-4" aria-hidden />
              )}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
