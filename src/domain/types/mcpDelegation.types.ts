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

/** One per-call result posted back to `/resume-tool` (ordered to match calls).
 *  Exactly one field is set: success → `tool_result`, failure/skip →
 *  `tool_error` (the run degrades + reports it). */
export interface DelegationResult {
  tool_result?: string;
  tool_error?: string;
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

/** Top-level KIND key for a remote-OAuth connector re-auth pause (distinct from
 *  ask_user's `schema` and delegation's `mcp_tool_delegation`). */
export const MCP_REAUTH_INTERRUPT_KIND = 'connector_reauth';

/** The envelope under `interrupt_value.connector_reauth`. */
export interface ReauthEnvelope {
  connector_id: string;
  display_name: string;
  auth_type: string;
  reason: string;
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
