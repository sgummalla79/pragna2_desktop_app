/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * Tauri's `invoke()` rejects with a plain **string** (the Rust `Err(String)`)
 * rather than a JS `Error`, so `(e instanceof Error) ? e.message : fallback`
 * always hits the fallback for Rust errors and hides the real cause (CF-014).
 * This helper handles all three cases: `Error`, plain string, and anything else.
 *
 * @param e         The caught value (any shape).
 * @param fallback  Returned when `e` carries no usable message text.
 */
export function extractErrorMessage(e: unknown, fallback = 'An unexpected error occurred.'): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string' && e.trim().length > 0) return e.trim();
  return fallback;
}
