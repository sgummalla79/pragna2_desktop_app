/**
 * A flow exposed as a `/slash` command in chat.
 *
 * This is the lightweight chat-surface projection returned by the pragna
 * discovery endpoint (`GET /api/pragna/flows`) — NOT the full settings `Flow`
 * (see {@link ../types/flow.types}). It carries only what the chat composer's
 * slash popover needs to render a suggestion and route the dispatch.
 */
export interface PragnaSlashFlow {
  /**
   * The `/slash` command name. URL-safe; this exact value is used both as the
   * popover label (`/{slashApiName}`) and as the `{name}` path segment when
   * dispatching to `POST /api/pragna/flows/{name}`.
   */
  slashApiName: string;
  /** Human-readable flow label shown in the popover. */
  displayName: string;
  /** Free-form description shown under the label; may be empty. */
  description: string;
}
