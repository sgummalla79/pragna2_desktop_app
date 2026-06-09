/** Routing conditions a flow edge can carry. */
export const EDGE_CONDITIONS = {
  DEFAULT: 'default',
  PASSED: 'passed',
  FAILED: 'failed',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type EdgeConditionValue = (typeof EDGE_CONDITIONS)[keyof typeof EDGE_CONDITIONS];

/** Human labels for each condition (canvas edge labels). */
export const EDGE_CONDITION_LABELS: Record<string, string> = {
  [EDGE_CONDITIONS.DEFAULT]: 'Default',
  [EDGE_CONDITIONS.PASSED]: 'Passed',
  [EDGE_CONDITIONS.FAILED]: 'Failed',
  [EDGE_CONDITIONS.APPROVED]: 'Approved',
  [EDGE_CONDITIONS.REJECTED]: 'Rejected',
};

/**
 * Theme-token colors per edge condition (CSS variable references so they follow
 * the active theme). `passed`/`approved` → primary (positive), `rejected` →
 * destructive (negative), `default`/`failed` → muted (least weight). The textual
 * edge label carries the finer semantic distinction.
 */
export const EDGE_CONDITION_COLORS: Record<string, string> = {
  [EDGE_CONDITIONS.DEFAULT]: 'var(--color-muted-foreground)',
  [EDGE_CONDITIONS.PASSED]: 'var(--color-primary)',
  [EDGE_CONDITIONS.FAILED]: 'var(--color-muted-foreground)',
  [EDGE_CONDITIONS.APPROVED]: 'var(--color-primary)',
  [EDGE_CONDITIONS.REJECTED]: 'var(--color-destructive)',
};
