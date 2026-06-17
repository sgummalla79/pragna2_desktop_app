import { MCP_TOOL_PREFIX, TOOL_DISPLAY_LABELS } from '@/constants/toolLabels';

/**
 * Presentation helpers for rendering a chat tool call as a clean, human-readable
 * activity — never the raw internal name, raw args JSON, or raw result.
 */

/** Max characters of an argument value shown in the collapsed-header summary. */
const SUMMARY_ARG_MAX_CHARS = 72;

/**
 * Friendly, user-facing label for a tool call name.
 *
 * Curated names win; otherwise the name is humanized: the `mcp_` namespace
 * prefix is stripped, the remainder is split on `_`/`-`/whitespace, consecutive
 * duplicate words are collapsed (so `mcp_tavily_tavily_search` → "Tavily
 * Search", not "Tavily Tavily Search"), and each word is title-cased.
 *
 * @param name - The internal tool name from the tool-call event.
 * @returns A label safe to show in the transcript (falls back to `name` if it
 *   contains no usable word characters).
 */
export function toolDisplayLabel(name: string): string {
  const curated = TOOL_DISPLAY_LABELS[name];
  if (curated) return curated;

  const base = name.startsWith(MCP_TOOL_PREFIX)
    ? name.slice(MCP_TOOL_PREFIX.length)
    : name;
  const words = base.split(/[_\-\s]+/).filter(Boolean);
  const deduped = words.filter(
    (w, i) => w.toLowerCase() !== words[i - 1]?.toLowerCase(),
  );
  if (deduped.length === 0) return name;
  return deduped.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * A short one-line summary of the call's arguments for the collapsed header —
 * the first non-empty string argument, whitespace-collapsed and ellipsised.
 *
 * @param args - The parsed tool arguments (undefined while still streaming).
 * @returns A summary string, or '' when there is no suitable argument.
 */
export function toolArgSummary(args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  for (const value of Object.values(args)) {
    if (typeof value === 'string' && value.trim()) {
      const v = value.trim().replace(/\s+/g, ' ');
      return v.length > SUMMARY_ARG_MAX_CHARS
        ? `${v.slice(0, SUMMARY_ARG_MAX_CHARS).trimEnd()}…`
        : v;
    }
  }
  return '';
}

/** A readable key/value pair for the expanded argument list. */
export interface ToolArgEntry {
  /** Humanized argument label (e.g. "Time range"). */
  key: string;
  /** Human-readable value — never raw JSON. */
  value: string;
}

/** Humanize an argument key: `time_range` → "Time range". */
export function humanizeArgKey(key: string): string {
  const words = key.split(/[_\-\s]+/).filter(Boolean);
  if (words.length === 0) return key;
  const joined = words.join(' ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * Render a single argument value as a compact, human-readable string — NEVER a
 * raw JSON blob. Primitives are shown as-is; arrays/objects are summarized by
 * count so a large payload never floods the transcript.
 */
export function formatToolArgValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length === 1 ? '1 item' : `${value.length} items`;
  if (typeof value === 'object') {
    const n = Object.keys(value as Record<string, unknown>).length;
    return n === 1 ? '1 field' : `${n} fields`;
  }
  return String(value);
}

/**
 * Build the readable argument list for the expanded view.
 *
 * @param args - The parsed tool arguments (undefined while streaming).
 * @returns Humanized key + readable value pairs (empty when there are no args).
 */
export function toolArgEntries(
  args: Record<string, unknown> | undefined,
): ToolArgEntry[] {
  if (!args) return [];
  return Object.entries(args).map(([key, value]) => ({
    key: humanizeArgKey(key),
    value: formatToolArgValue(value),
  }));
}
