import type { FC, SVGProps } from 'react';

/**
 * An agent mark rendered by an animation strategy — the svgr React component
 * imported from `@brand/agent-icon.svg?react` (the brand overlay's icon, else
 * the default brand logo).
 */
export type AgentIcon = FC<SVGProps<SVGSVGElement>>;

/** Props every animation strategy component receives. */
export interface AgentAnimationProps {
  /** Whether a run is in flight — drives the active (animating) state. */
  active: boolean;
  /** The agent icon to render (decoupled from the brand logo). */
  Icon: AgentIcon;
  /** Optional extra classes merged onto the rendered icon/wrapper. */
  className?: string;
}

/**
 * A self-contained thinking-indicator animation. New animations are added as
 * new modules registered in `registry.ts` — never by editing existing ones
 * (Open/Closed). The active strategy is selected by `key` from build-time
 * branding config, so call sites carry no animation literals.
 */
export interface AgentAnimationStrategy {
  /** Stable identifier used by branding config (`VITE_AGENT_ANIMATION`). */
  key: string;
  /** Human-readable label (for docs / future settings UI). */
  label: string;
  /** The component that renders the icon with this animation. */
  Component: FC<AgentAnimationProps>;
}
