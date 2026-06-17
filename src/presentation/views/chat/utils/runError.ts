/**
 * Classification of a terminal AG-UI `RUN_ERROR` event for the chat surface.
 *
 * The backend emits an in-band `RUN_ERROR` event when a background run fails
 * mid-stream (e.g. an LLM 400). ag-ui delivers it to `onRunErrorEvent` and does
 * NOT throw, so the thrown-error path (`onRunFailed`) never fires for it. A
 * client-side abort (Stop / navigation) is *also* delivered as a `RUN_ERROR`,
 * but tagged `code: 'abort'` — that must unwind silently, not raise an error
 * banner (CF-006). This helper makes that one decision, purely and testably.
 */
export interface RunErrorClassification {
  /** True when this is a client-side abort — surface nothing, just go idle. */
  aborted: boolean;
  /** User-facing message to display when not aborted. */
  message: string;
}

/**
 * Decide whether a `RUN_ERROR` event is a silent abort or a real failure, and
 * pick the message to show for a real failure.
 *
 * @param event - The RUN_ERROR event (only `code` / `message` are read).
 * @param fallbackMessage - Shown when the event carries no message (the backend
 *   sanitizes its message, but it can be empty).
 * @returns `{ aborted, message }` — when `aborted`, the caller shows nothing.
 */
export function classifyRunErrorEvent(
  event: { code?: string; message?: string },
  fallbackMessage: string,
): RunErrorClassification {
  const message = event.message ?? '';
  const aborted = event.code === 'abort' || /abort|cancel/i.test(message);
  return { aborted, message: message || fallbackMessage };
}
