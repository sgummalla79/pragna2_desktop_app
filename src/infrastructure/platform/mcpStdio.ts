import { invoke } from '@tauri-apps/api/core';

import type {
  ClientToolSchema,
  StdioServerConfig,
} from '@/domain/types/mcp.types';

import { isTauriRuntime } from './runtime';

/**
 * Frontend wrapper over the Rust `mcp_stdio_*` Tauri commands — the local
 * client-delegated stdio MCP host (Phase F). The ONLY file that invokes those
 * commands (platform-abstraction rule). Mirrors `secureStore.ts`.
 *
 * Outside the Tauri runtime (e.g. the `pnpm dev` browser shell) there is no
 * local host, so the calls throw `NotInTauriError` — local MCP servers are a
 * desktop-only capability. The capability gate on the backend already prevents
 * a browser client from being asked to run a stdio tool.
 */

export class NotInTauriError extends Error {
  constructor() {
    super('Local (stdio) MCP servers are only available in the desktop app.');
    this.name = 'NotInTauriError';
  }
}

/** Rust returns tool schemas with snake_case `input_schema`. */
interface RustToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const mcpStdio = {
  /** Discover a server's tools (ephemeral spawn → list_tools → teardown). */
  async discover(cfg: StdioServerConfig): Promise<ClientToolSchema[]> {
    if (!isTauriRuntime()) throw new NotInTauriError();
    const tools = await invoke<RustToolSchema[]>('mcp_stdio_discover', {
      command: cfg.command,
      args: cfg.args,
      env: cfg.env,
    });
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.input_schema,
    }));
  },

  /** Run a delegated tool call against the connector's warm local server.
   *  The Rust side reads the launch config (incl. env secrets) from the
   *  keychain — secrets never cross this boundary. */
  async call(
    connectorId: string,
    upstreamName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!isTauriRuntime()) throw new NotInTauriError();
    return invoke<string>('mcp_stdio_call', {
      connectorId,
      upstreamName,
      args,
    });
  },

  /** Persist a connector's launch config (incl. env secrets) in the keychain. */
  async saveConfig(connectorId: string, cfg: StdioServerConfig): Promise<void> {
    if (!isTauriRuntime()) throw new NotInTauriError();
    await invoke('mcp_stdio_save_config', {
      connectorId,
      command: cfg.command,
      args: cfg.args,
      env: cfg.env,
    });
  },

  /** Remove a connector's stored launch config (server removed). */
  async clearConfig(connectorId: string): Promise<void> {
    if (!isTauriRuntime()) return; // no-op in browser
    try {
      await invoke('mcp_stdio_clear_config', { connectorId });
    } catch (error) {
      console.warn('[mcpStdio] clearConfig failed', error);
    }
  },

  /** Run `<command> auth` to trigger the mcp-adaptor OAuth browser flow.
   *
   *  Call this when a save fails with an error starting with
   *  {@link MCP_AUTH_EXPIRED_PREFIX}, then retry the save. The subprocess opens a
   *  browser window, handles the OAuth callback, and stores fresh tokens in the OS
   *  keyring before exiting. Resolves when the flow completes successfully; rejects
   *  (with the Rust error string) if the subprocess cannot be launched or exits
   *  non-zero (user cancelled, gateway rejected). */
  async auth(command: string): Promise<void> {
    if (!isTauriRuntime()) throw new NotInTauriError();
    await invoke('mcp_stdio_auth', { command });
  },

  /** Load the whole-config editor blob (the `mcpServers` JSON the user authors)
   *  from the keychain — the authoring source of truth. `null` when never saved
   *  / not in Tauri. Reuses the generic `secure_store_*` commands. */
  async loadEditorConfig(): Promise<string | null> {
    if (!isTauriRuntime()) return null;
    try {
      const value = await invoke<string | null>('secure_store_get', {
        key: EDITOR_CONFIG_KEY,
      });
      return value ?? null;
    } catch (error) {
      console.warn('[mcpStdio] loadEditorConfig failed', error);
      return null;
    }
  },

  /** Persist the whole-config editor blob (may contain env secrets) in the
   *  keychain. */
  async saveEditorConfig(json: string): Promise<void> {
    if (!isTauriRuntime()) throw new NotInTauriError();
    await invoke('secure_store_set', { key: EDITOR_CONFIG_KEY, value: json });
  },
};

/** Keychain key for the whole-config editor blob (the authored `mcpServers`). */
const EDITOR_CONFIG_KEY = 'mcp_stdio_editor_config';
