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
