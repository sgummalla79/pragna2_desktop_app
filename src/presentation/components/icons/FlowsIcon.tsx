/**
 * Flows icon — the branching-nodes glyph used for the Flows feature
 * everywhere it appears: the Settings menu, the Flows page header, the
 * empty state, and the per-flow cards. One definition so they never drift.
 */

interface Props {
  size?: number;
  className?: string;
}

export function FlowsIcon({ size = 18, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M6 9v6M13 6h3a2 2 0 0 1 2 2v7" />
    </svg>
  );
}
