/**
 * Episode-lifecycle client constants.
 *
 * Externalised here per the no-hardcoding rule (tuning values that shape polling
 * behaviour, not business data).
 */

/**
 * Poll cadence (ms) for the open-episode lookup while an episode is `active`
 * — e.g. a `create_pdf_long` document generating in its background episode.
 *
 * Polling lets the chat surface observe the `active` → terminal transition while
 * the user stays on the conversation, so the generated document's card surfaces
 * automatically (without the manual chat switch that the no-poll behaviour
 * required). The query is a cheap `list(limit:1)`, so a few-second cadence over a
 * multi-minute generation is inexpensive.
 */
export const OPEN_EPISODE_ACTIVE_POLL_MS = 4_000;
