/**
 * MockMcpSpec — the single declarative behavior contract that BOTH mock impls
 * (Node `node/` and the standalone Rust crate `rust/`) deserialize, so they stay
 * behaviorally equivalent. Presets live in `spec/presets/*.json`.
 *
 * A spec is supplied to a mock via the `MOCK_MCP_SPEC` env var, which is EITHER
 * an absolute path to a preset JSON file OR an inline JSON string (impls try to
 * read it as a file first, then fall back to parsing it as a literal).
 *
 * This mirrors the host contract the desktop's Rust MCP host expects
 * (`src-tauri/src/platform/mcp_registry.rs`, `src-tauri/src/domain/mcp.rs`):
 *  - `tools/list` → `{ name, description, inputSchema }[]`
 *  - `tools/call` → a result whose flattened content drives the host's
 *    auth-signal classification (`AUTH_ERROR_RESULT_SIGNALS`) and provider
 *    extraction (`for provider '<x>'`).
 */

/** One canned outcome for a tool call. The Nth call to a tool uses
 *  `responses[min(N, responses.length - 1)]` (last response repeats). */
export interface MockToolResponse {
  /**
   * - `result`    — a normal success result (`isError=false`).
   * - `error`     — a NON-auth error body (`isError=true`); the host must NOT
   *                 misclassify it as auth (negative guard).
   * - `authError` — an auth-failure the host should classify as AuthRequired.
   */
  kind: 'result' | 'error' | 'authError';
  /** Delay before responding, ms — probes the host's per-call timeout. */
  callDelayMs?: number;
  /** Result/error body text (for `result` / `error`). */
  content?: string;
  /**
   * For `authError`: an auth signal substring to embed in the body so the host's
   * `is_auth_error_signal` matches (e.g. `"401"`, `"invalid_grant"`,
   * `"token expired"`). One of the desktop's `AUTH_ERROR_RESULT_SIGNALS`.
   */
  signal?: string;
  /**
   * For `authError`: emit `failed to fetch required token for provider '<x>': …`
   * so the host's `service_from_error_text` extracts `<x>` as the service.
   */
  providerInError?: string;
  /**
   * For `error` / `authError`: how the failure reaches the host.
   * - `isError`     — return a CallToolResult with `isError=true` (default).
   * - `raisedError` — raise a JSON-RPC/protocol error (host sees `Err(..)`).
   */
  channel?: 'isError' | 'raisedError';
}

/** A tool exposed by the mock server. */
export interface MockTool {
  name: string;
  description?: string;
  /** JSON-Schema `inputSchema` object; defaults to an empty object schema. */
  inputSchema?: Record<string, unknown>;
  /** Ordered canned outcomes (see {@link MockToolResponse}). */
  responses: MockToolResponse[];
}

/** Behavior of the `<command> auth [--provider <svc>]` re-auth subprocess. */
export interface MockAuthBehavior {
  /** Exit code when the provider check passes (0 = success). */
  exitCode?: number;
  /** When set, `auth` exits non-zero unless `--provider` equals this value. */
  requireProvider?: string;
}

/** The full mock behavior spec. */
export interface MockMcpSpec {
  /** Advertised server name (cosmetic). */
  serverName?: string;
  /** Delay the initialize handshake, ms — probes the host's startup timeout. */
  startupDelayMs?: number;
  /** Tools exposed via `tools/list` + answered by `tools/call`. */
  tools: MockTool[];
  /** `auth` subcommand behavior. */
  auth?: MockAuthBehavior;
}

const RESPONSE_KINDS = ['result', 'error', 'authError'] as const;

/**
 * Validate + normalize a parsed spec, throwing on malformed input so a bad
 * preset fails loudly rather than silently mis-behaving. Returns the spec with
 * defaults applied (empty `args`/`env`-style omissions handled by callers).
 */
export function validateSpec(raw: unknown): MockMcpSpec {
  if (!raw || typeof raw !== 'object') throw new Error('spec must be a JSON object');
  const spec = raw as Record<string, unknown>;
  if (!Array.isArray(spec.tools)) throw new Error('spec.tools must be an array');
  const tools: MockTool[] = spec.tools.map((t, i) => {
    if (!t || typeof t !== 'object') throw new Error(`spec.tools[${i}] must be an object`);
    const tool = t as Record<string, unknown>;
    if (typeof tool.name !== 'string' || !tool.name) {
      throw new Error(`spec.tools[${i}].name must be a non-empty string`);
    }
    if (!Array.isArray(tool.responses) || tool.responses.length === 0) {
      throw new Error(`spec.tools[${i}].responses must be a non-empty array`);
    }
    const responses: MockToolResponse[] = tool.responses.map((r, j) => {
      const resp = r as Record<string, unknown>;
      if (!RESPONSE_KINDS.includes(resp.kind as (typeof RESPONSE_KINDS)[number])) {
        throw new Error(`spec.tools[${i}].responses[${j}].kind invalid`);
      }
      return resp as unknown as MockToolResponse;
    });
    return {
      name: tool.name,
      description: typeof tool.description === 'string' ? tool.description : '',
      inputSchema:
        tool.inputSchema && typeof tool.inputSchema === 'object'
          ? (tool.inputSchema as Record<string, unknown>)
          : { type: 'object', properties: {} },
      responses,
    };
  });
  return {
    serverName: typeof spec.serverName === 'string' ? spec.serverName : 'mock-mcp',
    startupDelayMs: typeof spec.startupDelayMs === 'number' ? spec.startupDelayMs : 0,
    tools,
    auth: (spec.auth as MockAuthBehavior | undefined) ?? {},
  };
}

/**
 * Build the flattened error text for an `authError` response, combining the
 * provider marker (so `service_from_error_text` extracts it) and the auth signal
 * (so `is_auth_error_signal` matches). Shared by both impls' equivalents.
 */
export function authErrorText(resp: MockToolResponse): string {
  const provider = resp.providerInError
    ? `failed to fetch required token for provider '${resp.providerInError}': `
    : '';
  const signal = resp.signal ?? '401';
  const body = resp.content ?? 'authentication failed';
  return `${provider}${body} (${signal})`;
}
