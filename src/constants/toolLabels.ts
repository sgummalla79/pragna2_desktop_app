/**
 * User-facing presentation constants for chat tool calls.
 *
 * The chat surface must never show raw internal tool names (e.g.
 * `mcp_tavily_tavily_search`) or raw result JSON. These constants drive the
 * friendly labels in {@link toolDisplayLabel}; anything not listed here is
 * humanized generically from its name. Externalised here (not inlined in the
 * component) per the no-hardcoding rule — labels are display copy that can
 * change without touching render logic.
 */

/** Backend prefix that namespaces MCP tools: `mcp_<connector>_<tool>`. */
export const MCP_TOOL_PREFIX = 'mcp_';

/**
 * Curated labels for known built-in tools that can reach the generic badge.
 * Document tools and propose-flow tools are rendered by dedicated components
 * (DocumentCard / FlowProposalCard) and never hit this map.
 */
export const TOOL_DISPLAY_LABELS: Record<string, string> = {
  ask_user: 'Asking for input',
};
