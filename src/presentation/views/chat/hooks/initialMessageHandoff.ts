/**
 * Hand-off of the first message from the landing to the session view.
 *
 * The landing eager-creates the conversation, stashes the typed message (plus
 * the picker's model/thinking choices) in `sessionStorage` under the new
 * conversation id, then navigates to `/chat/{id}`. The session view reads and
 * immediately clears the entry, so a browser refresh does NOT replay the turn.
 */

const PREFIX = 'pragna:chat:pending:';

export interface PendingInitialMessage {
  /** The user's typed first message. */
  text: string;
  /** Landing model choice, applied as `?user_model_id=` on first send. */
  userModelId?: string;
  /** Landing extended-thinking choice, applied as `?thinking_enabled=`. */
  thinkingEnabled?: boolean;
}

/** Stash the pending first message for a freshly-created conversation. */
export function writePendingInitialMessage(
  conversationId: string,
  payload: PendingInitialMessage,
): void {
  try {
    sessionStorage.setItem(PREFIX + conversationId, JSON.stringify(payload));
  } catch {
    // Storage unavailable / quota — the session view simply won't auto-send.
  }
}

/** Read (without clearing) the pending first message, if any. */
export function readPendingInitialMessage(
  conversationId: string,
): PendingInitialMessage | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + conversationId);
    if (!raw) return null;
    return JSON.parse(raw) as PendingInitialMessage;
  } catch {
    return null;
  }
}

/** Remove the pending entry so a refresh won't replay the turn. */
export function clearPendingInitialMessage(conversationId: string): void {
  try {
    sessionStorage.removeItem(PREFIX + conversationId);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
