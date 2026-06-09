/**
 * Constants for chat `/slash` command parsing + the composer popover.
 *
 * These are intrinsic parsing/layout literals (a tokenisation rule and a render
 * cap), not configuration that changes without a redeploy — so they live here,
 * named, rather than inline in component/hook logic (per the no-hardcoding rule).
 */

/**
 * Matches a slash command at the START of the composer text: a leading `/`
 * followed by a name (lowercase letter or `_`, then letters/digits/`-`/`_`),
 * terminated by whitespace or end-of-string. Capture group 1 is the bare name
 * (no leading slash) used as the `{name}` path segment when dispatching to
 * `POST /api/pragna/flows/{name}`.
 */
export const SLASH_COMMAND_RE = /^\/([a-z_][a-z0-9_-]*)(?:\s|$)/;

/** Maximum number of suggestions rendered in the slash popover at once. */
export const SLASH_MAX_ITEMS = 8;
