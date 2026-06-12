import { useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, TerminalSquare, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
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
        <TerminalSquare className="mt-1 h-6 w-6 shrink-0 text-foreground/70" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Local MCP servers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Run MCP servers on this machine. They&rsquo;re discovered locally and
            delegated to from your chats — secrets in <code>env</code> stay in your
            OS keychain and never reach the server.
          </p>
        </div>
      </header>

      {/* Registered servers */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-foreground">
          Configured servers
        </h2>
        {localServers.length === 0 ? (
          <p className="rounded-md border border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No servers added yet. Add one in the config below.
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
      </section>

      {/* Config editor */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">Edit config</h2>
          <Button onClick={() => void handleSave()} disabled={saving} size="sm">
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden />
            )}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
        <textarea
          value={editorText}
          onChange={(e) => setEditorText(e.target.value)}
          spellCheck={false}
          rows={14}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Local MCP servers config (JSON)"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Example:{' '}
          <code>
            {'{ "mcpServers": { "files": { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"], "env": {} } } }'}
          </code>
        </p>
        {error && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </section>
    </div>
  );
}
