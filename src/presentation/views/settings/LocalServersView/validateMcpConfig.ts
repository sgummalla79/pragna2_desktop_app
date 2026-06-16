import type { LocalServersConfig, StdioServerConfig } from '@/domain/types/mcp.types';

export type ValidateResult =
  | { ok: true; formatted: string }
  | { ok: false; error: string };

/**
 * Parse, validate, and pretty-print a local MCP servers config JSON string.
 *
 * Called on paste and blur so the editor auto-formats valid JSON and surfaces
 * structural errors before the user hits Save.
 *
 * Rules checked beyond JSON syntax:
 * - Root must be an object with an `mcpServers` key whose value is an object.
 * - Each server entry must have a non-empty `command` string.
 * - `args`, if present, must be an array of strings.
 * - `env`, if present, must be an object whose values are all strings.
 */
export function validateAndFormatMcpConfig(text: string): ValidateResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: true, formatted: '{\n  "mcpServers": {}\n}' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON.';
    return { ok: false, error: `JSON syntax error: ${msg}` };
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, error: 'Config must be a JSON object.' };
  }

  const root = raw as Record<string, unknown>;
  if (!('mcpServers' in root)) {
    return { ok: false, error: 'Missing required key "mcpServers".' };
  }
  if (typeof root['mcpServers'] !== 'object' || root['mcpServers'] === null || Array.isArray(root['mcpServers'])) {
    return { ok: false, error: '"mcpServers" must be an object (map of server name → config).' };
  }

  const servers = root['mcpServers'] as Record<string, unknown>;
  for (const [name, entry] of Object.entries(servers)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `Server "${name}": config must be an object.` };
    }
    const cfg = entry as Record<string, unknown>;

    if (typeof cfg['command'] !== 'string' || (cfg['command'] as string).trim() === '') {
      return { ok: false, error: `Server "${name}": "command" must be a non-empty string.` };
    }

    if ('args' in cfg) {
      if (!Array.isArray(cfg['args']) || (cfg['args'] as unknown[]).some((a) => typeof a !== 'string')) {
        return { ok: false, error: `Server "${name}": "args" must be an array of strings.` };
      }
    }

    if ('env' in cfg) {
      if (typeof cfg['env'] !== 'object' || cfg['env'] === null || Array.isArray(cfg['env'])) {
        return { ok: false, error: `Server "${name}": "env" must be an object (string → string map).` };
      }
      for (const [k, v] of Object.entries(cfg['env'] as Record<string, unknown>)) {
        if (typeof v !== 'string') {
          return { ok: false, error: `Server "${name}": env["${k}"] must be a string.` };
        }
      }
    }
  }

  const typed: LocalServersConfig = {
    mcpServers: Object.fromEntries(
      Object.entries(servers).map(([name, entry]) => {
        const cfg = entry as Partial<StdioServerConfig>;
        return [
          name,
          {
            command: cfg.command ?? '',
            args: cfg.args ?? [],
            env: cfg.env ?? {},
          } satisfies StdioServerConfig,
        ];
      }),
    ),
  };

  return { ok: true, formatted: JSON.stringify(typed, null, 2) };
}
