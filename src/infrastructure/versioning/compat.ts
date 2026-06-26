// Version-compatibility helpers (mirror of the API's src/application/versioning.py).
// Compatibility is decided on the MAJOR.MINOR key — the PATCH/build digit is
// ignored — and compared as a (major, minor) pair so 1.2 > 1.1 > 1.0.
// See nexus-kit-api/docs/architecture/version-compatibility.md.

export type Compat = [major: number, minor: number];

/**
 * Extract the (major, minor) compatibility key from a version string.
 * The PATCH/build digit and any suffix are ignored. Malformed input degrades
 * to [0, 0] rather than throwing.
 */
export function parseCompat(version: string): Compat {
  const parts = version.trim().split('.');
  return [safeInt(parts[0] ?? ''), safeInt(parts[1] ?? '')];
}

/** Render a (major, minor) tuple as the "major.minor" string. */
export function formatCompat(compat: Compat): string {
  return `${compat[0]}.${compat[1]}`;
}

/** Compare two compat keys: negative if a < b, 0 if equal, positive if a > b. */
export function compareCompat(a: Compat, b: Compat): number {
  return a[0] !== b[0] ? a[0] - b[0] : a[1] - b[1];
}

/** Whether compat `a` is greater than or equal to compat `b`. */
export function isAtLeast(a: Compat, b: Compat): boolean {
  return compareCompat(a, b) >= 0;
}

/** Parse the leading integer of a dotted version component, treating junk as 0. */
function safeInt(part: string): number {
  const match = part.trim().match(/^\d+/);
  return match ? parseInt(match[0], 10) : 0;
}
