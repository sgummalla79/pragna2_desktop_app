/**
 * Human-friendly "time ago" formatting for ISO timestamps.
 *
 * Boundary values are fixed time arithmetic (math constants, not configuration)
 * and live here in SCREAMING_SNAKE_CASE per the no-hardcoding rule.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** Beyond this many days, show an absolute date instead of "N days ago". */
const RELATIVE_DAY_CUTOFF = 30;

/**
 * Returns a relative label for an ISO timestamp: "10 minutes ago", "3 hours
 * ago", "yesterday", "5 days ago", then an absolute date past
 * {@link RELATIVE_DAY_CUTOFF} days. Sub-minute differences clamp to "1 minute
 * ago"; future timestamps (clock skew) also clamp to "1 minute ago".
 */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();

  if (diff < HOUR_MS) {
    const minutes = Math.max(1, Math.floor(diff / MINUTE_MS));
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  }
  if (diff < DAY_MS) {
    const hours = Math.floor(diff / HOUR_MS);
    return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  }

  const days = Math.floor(diff / DAY_MS);
  if (days === 1) return 'yesterday';
  if (days < RELATIVE_DAY_CUTOFF) return `${days} days ago`;

  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
