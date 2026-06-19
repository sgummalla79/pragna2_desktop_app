/**
 * Chat behavioral constants.
 *
 * `CONTINUE_PROMPT` is the literal user turn sent to resume an assistant
 * response that was cut off at the model's output limit (`finish_reason ===
 * 'length'`). It's a fixed protocol value, externalised here (per the
 * no-hardcoding rule) rather than inlined in the chat surface.
 */
import type { FinishReason } from '@/domain/types/conversation.types';

export const CONTINUE_PROMPT = 'continue';

/**
 * Finish reasons that TERMINATE an assistant turn — the model has stopped acting
 * and the turn is complete. Deliberately excludes `'tool_calls'` (mid-turn: the
 * turn continues after tool results). Used to split a completed turn from a
 * later adjacent one in the transcript grouping so a re-attached streaming run
 * never folds the prior turn into its activity umbrella (tracker #148).
 * Externalised here (no-hardcoding) so the desktop + web FE classify terminal
 * turns identically. NOTE: a turn with `finishReason === null` (legacy rows
 * pre-BE-migration-0022) is NOT terminal and won't split — acceptable, since the
 * backend stamps a finish reason on every turn since 0022.
 */
export const TERMINAL_FINISH_REASONS: ReadonlySet<FinishReason> = new Set<FinishReason>([
  'stop',
  'length',
  'other',
]);

/**
 * Backend prefix for propose-flow tool names (`propose_flow_<api_name>`). A tool
 * call with this prefix renders an interactive `FlowProposalCard`, not a plain
 * tool badge — so it is treated as a turn "output" (rendered in the transcript),
 * never folded into the activity umbrella. Externalised here (per the
 * no-hardcoding rule) so the renderer and the turn-grouping logic agree.
 */
export const PROPOSE_FLOW_PREFIX = 'propose_flow_';

/**
 * How long a per-conversation usage aggregate (`…/usage`) stays fresh before
 * the sidebar cost chip refetches. Bounds each row to one request per window
 * (60s, matching the web app) so a long sidebar doesn't fan out a request per
 * row on every render.
 */
export const USAGE_STALE_MS = 60_000;
