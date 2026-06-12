import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
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
import { logger } from '@/infrastructure/logging/logger';
import { mcpStdio, NotInTauriError } from '@/infrastructure/platform';
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

  const localServers = useMemo<McpConnector[]>(
    () => (connectors ?? []).filter((c) => c.transport === 'stdio'),
    [connectors],
  );

  const [editorText, setEditorText] = useState(EMPTY_CONFIG);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Whether the slide-in config editor panel is open.
  const [panelOpen, setPanelOpen] = useState(false);
  // Whether the "Example config" accordion is expanded.
  const [exampleOpen, setExampleOpen] = useState(false);

  // Load the authored config blob from the keychain (the editing source of
  // truth). Falls back to an empty template the first time.
  useEffect(() => {
    void mcpStdio.loadEditorConfig().then((blob) => {
      if (blob) setEditorText(blob);
    });
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setNotice(null);

    let parsed: LocalServersConfig;
    try {
      parsed = JSON.parse(editorText) as LocalServersConfig;
      if (!parsed || typeof parsed.mcpServers !== 'object') {
        throw new Error('Config must be an object with an "mcpServers" map.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid JSON.');
      return;
    }

    const entries = Object.entries(parsed.mcpServers);

    // Consent (spec MUST): show the full commands before the first spawn.
    if (entries.length > 0) {
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
      setNotice(`Saved — ${entries.length} local server(s) configured.`);
      // Close the editor panel; the refreshed Configured servers list and the
      // success notice are shown on the page behind it.
      setPanelOpen(false);
    } catch (e) {
      if (e instanceof NotInTauriError) {
        setError('Local MCP servers are only available in the desktop app.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to save local servers.');
        logger.fromError(
          'LSV_001:save',
          e instanceof Error ? e : new Error(String(e)),
        );
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
              setNotice(null);
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
            {localServers.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleRemove(c)}
                  aria-label={`Remove ${c.displayName}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {notice && (
          <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </section>

      {/* Slide-in config editor */}
      <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
        <SheetContent className="sm:max-w-xl">
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
            onChange={(e) => setEditorText(e.target.value)}
            spellCheck={false}
            className="min-h-0 w-full flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Local MCP servers config (JSON)"
          />

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <SheetFooter>
            <Button onClick={() => void handleSave()} disabled={saving}>
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
