/**
 * Client-delegated stdio MCP delegation types (Phase F).
 *
 * When a hosted run calls a stdio tool, the backend pauses and emits an
 * `on_interrupt` whose `interrupt_value` carries the delegation envelope below
 * (snake_case, as the backend wrote it). The desktop runs each call locally and
 * resumes via `POST .../episodes/{ep}/resume-tool` with an ordered results list.
 */

/** The top-level KIND key the backend uses for a client-delegated tool pause
 *  (distinct from ask_user's `schema` key). */
export const MCP_DELEGATION_INTERRUPT_KIND = 'mcp_tool_delegation';

/** One delegated call — wire shape (snake_case) read off `interrupt_value`. */
export interface DelegationCall {
  connector_id: string;
  tool_api_name: string;
  upstream_name: string;
  args: Record<string, unknown>;
  tool_call_id: string | null;
}

/** The envelope under `interrupt_value.mcp_tool_delegation`. */
export interface DelegationEnvelope {
  calls: DelegationCall[];
}

/** Wire key of the structured auth-required result variant (mirrors nexus-kit-api
 *  `MCP_DELEGATION_RESUME_AUTH_REQUIRED_KEY`). */
export const MCP_DELEGATION_RESUME_AUTH_REQUIRED_KEY = 'auth_required';

/** The structured auth-required signal a delegated result may carry instead of
 *  `tool_result`/`tool_error` (tracker #124). The backend turns this into a
 *  per-service `connector_reauth` pause. Keys mirror nexus-kit-api
 *  `MCP_AUTH_REQUIRED_KEY_*`. */
export interface AuthRequiredResult {
  /** The downstream provider (e.g. `gus`), or `null` when not derivable. */
  service: string | null;
  /** Why re-auth is needed (defaults to `token_expired` on the BE if omitted). */
  reason: string;
  /** Optional connect URL (Phase 2 / remote aggregators); `null` for stdio today. */
  authorization_url: string | null;
}

/** One per-call result posted back to `/resume-tool` (ordered to match calls).
 *  Exactly ONE field is set: success → `tool_result`; failure/skip →
 *  `tool_error` (the run degrades + reports it); a downstream auth failure →
 *  `auth_required` (the run pauses for a per-service re-auth card, #124). */
export interface DelegationResult {
  tool_result?: string;
  tool_error?: string;
  auth_required?: AuthRequiredResult;
}

/** Outcome of `mcpStdio.call` — the tagged shape the Rust `mcp_stdio_call`
 *  command returns (`#[serde(tag = "kind")]`). A normal `result`, or
 *  `auth_required` when the aggregator's downstream-service token is dead (#124).
 *  `service` may be `null` when the connector's launch config carries no
 *  `--server`/`--provider` flag. */
export type McpStdioCallOutcome =
  | { kind: 'result'; content: string }
  | { kind: 'auth_required'; service: string | null; reason: string };

/** Map a local stdio call outcome to the `/resume-tool` result the BE expects: a
 *  normal `result` → `tool_result`; an `auth_required` outcome → the structured
 *  `auth_required` variant (#124). A thrown call is handled by the caller as a
 *  `tool_error`. */
export function delegationResultFromOutcome(
  outcome: McpStdioCallOutcome,
): DelegationResult {
  if (outcome.kind === 'auth_required') {
    return {
      auth_required: {
        service: outcome.service,
        reason: outcome.reason,
        authorization_url: null,
      },
    };
  }
  return { tool_result: outcome.content };
}

/** Body for `POST .../episodes/{ep}/resume-tool`. */
export interface ResumeToolPayload {
  results: DelegationResult[];
}

/**
 * Read the delegation envelope off an episode's `interruptValue`, or `null` when
 * the pause is not a delegation (e.g. an ask_user form).
 */
export function readDelegationEnvelope(
  interruptValue: unknown,
): DelegationEnvelope | null {
  if (interruptValue && typeof interruptValue === 'object') {
    const v = (interruptValue as Record<string, unknown>)[
      MCP_DELEGATION_INTERRUPT_KIND
    ];
    if (v && typeof v === 'object' && Array.isArray((v as DelegationEnvelope).calls)) {
      return v as DelegationEnvelope;
    }
  }
  return null;
}

/* ── Connector re-auth pause (#2) ──────────────────────────────────────────── */

/** Top-level KIND key for a connector re-auth pause (distinct from ask_user's
 *  `schema` and delegation's `mcp_tool_delegation`). Boundary-aware (#122): the
 *  same kind covers a remote-OAuth connector (`boundary=connector`) and an
 *  aggregator's downstream service (`boundary=downstream_service`). */
export const MCP_REAUTH_INTERRUPT_KIND = 'connector_reauth';

/** Which token boundary needs re-auth (mirrors nexus-kit-api
 *  `MCP_REAUTH_BOUNDARY_*`). `connector` = a remote connector whose OAuth WE
 *  hold; `downstream_service` = an aggregator's per-provider token (e.g. GUS in
 *  an mcp-adaptor) the adaptor owns — re-auth runs the adaptor's own flow. */
export const MCP_REAUTH_BOUNDARY_CONNECTOR = 'connector';
export const MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE = 'downstream_service';

/** Stdio transport discriminator on the envelope (mirrors the BE / mcp.types). */
export const MCP_REAUTH_TRANSPORT_STDIO = 'stdio';

/** The envelope under `interrupt_value.connector_reauth`. The original four
 *  fields are always present; the rest are ADDITIVE (#122/#123) — an older
 *  envelope without them still parses, and the remote-OAuth card path ignores
 *  them. */
export interface ReauthEnvelope {
  connector_id: string;
  display_name: string;
  auth_type: string;
  reason: string;
  /** Which token boundary died — see `MCP_REAUTH_BOUNDARY_*`. Absent on older
   *  envelopes (treated as `connector`). */
  boundary?: string;
  /** Transport of the connector (`stdio` | `streamable_http` | `http`). */
  transport?: string;
  /** Downstream provider name for an aggregator (e.g. `gus`), or `null`. */
  service?: string | null;
  /** Optional connect URL to open instead of running a local flow (Phase 2). */
  authorization_url?: string | null;
  /** Advisory list of resume actions the BE offers (e.g. `["retry","continue"]`). */
  resume_actions?: string[];
}

/** True when the pause is an aggregator downstream-service re-auth (#124): the
 *  card drives the adaptor's own `auth --provider <service>` flow rather than our
 *  connector OAuth. */
export function isDownstreamServiceReauth(envelope: ReauthEnvelope): boolean {
  return envelope.boundary === MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE;
}

/** The user's choice, posted to `/resume-reauth`. `retry` = they reconnected,
 *  re-run the tool call; `continue` = skip it, degrade to a tool_error. */
export type ReauthAction = 'retry' | 'continue';

/** Body for `POST .../episodes/{ep}/resume-reauth`. */
export interface ResumeReauthPayload {
  action: ReauthAction;
}

/**
 * Read the re-auth envelope off an episode's `interruptValue`, or `null` when
 * the pause is not a connector re-auth (delegation / ask_user).
 */
export function readReauthEnvelope(
  interruptValue: unknown,
): ReauthEnvelope | null {
  if (interruptValue && typeof interruptValue === 'object') {
    const v = (interruptValue as Record<string, unknown>)[
      MCP_REAUTH_INTERRUPT_KIND
    ];
    if (v && typeof v === 'object' && 'connector_id' in v) {
      return v as ReauthEnvelope;
    }
  }
  return null;
}
