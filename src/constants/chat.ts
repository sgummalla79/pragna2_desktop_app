/**
 * Chat behavioral constants.
 *
 * `CONTINUE_PROMPT` is the literal user turn sent to resume an assistant
 * response that was cut off at the model's output limit (`finish_reason ===
 * 'length'`). It's a fixed protocol value, externalised here (per the
 * no-hardcoding rule) rather than inlined in the chat surface.
 */
export const CONTINUE_PROMPT = 'continue';

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
