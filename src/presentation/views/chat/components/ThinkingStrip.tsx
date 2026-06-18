import AgentIcon from '@brand/agent-icon.svg?react';
import { AGENT_ANIMATION_KEY } from '@/constants/api';
import { getAgentAnimation } from '@/presentation/components/agent-animation/registry';

interface Props {
  /** Whether a run is in flight — drives the agent animation + status text. */
  active: boolean;
  /** Latest progress label from the agent's `on_progress` event, if any. */
  label: string | null;
}

/** Default status when the agent is working but hasn't emitted a label yet. */
const DEFAULT_LABEL = 'Thinking…';

// Resolved once at module load: the build-time-selected thinking animation.
// The agent icon defaults to the brand logo (stock = original Pragna look) and
// is brandable independently via @brand/agent-icon.svg; the animation is chosen
// by key, so branders can opt into a distinct mark + motion (e.g. brain+bubbles).
const { Component: AgentAnimation } = getAgentAnimation(AGENT_ANIMATION_KEY);

/**
 * Persistent agent indicator at the bottom of the messages column — matches the
 * web FE / claude.ai. Two states:
 *
 * - **Idle** (`active === false`): a static agent icon, no text — "ready for
 *   your next message". It stays on screen after a reply instead of vanishing.
 * - **Thinking** (`active === true`): the selected agent animation plays and the
 *   live status label (or a default) renders beside it.
 */
export function ThinkingStrip({ active, label }: Props) {
  return (
    <div
      data-testid="thinking-strip"
      className="flex w-full items-center gap-2 px-1 py-1"
      role="status"
      aria-live="polite"
      aria-label={
        active ? `Agent status: ${label ?? DEFAULT_LABEL}` : 'Ready for your next message'
      }
    >
      <AgentAnimation active={active} Icon={AgentIcon} />
      {active && (
        <span className="text-sm text-muted-foreground">{label ?? DEFAULT_LABEL}</span>
      )}
    </div>
  );
}
