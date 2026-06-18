import { cn } from '@/lib/utils';
import type { AgentAnimationProps, AgentAnimationStrategy } from '../AgentAnimation.types';
import { AGENT_ICON_SIZE } from '../constants';
import './bubblesBrain.css';

/**
 * Particle layout for the rising bubbles — horizontal offset, stagger delay, and
 * diameter (px). Intrinsic to this animation's visual design (not user config),
 * so it lives here as a named constant rather than inline literals.
 */
const BUBBLE_PARTICLES: ReadonlyArray<{ left: string; delay: string; size: number }> = [
  { left: '22%', delay: '0s', size: 4 },
  { left: '50%', delay: '0.45s', size: 6 },
  { left: '74%', delay: '0.9s', size: 3 },
];

/**
 * "Bubbles from the brain": the agent icon gently pulses while a soft column of
 * bubbles rises above it during a run. Idle renders just the static icon.
 */
function BubblesBrainAnimation({ active, Icon, className }: AgentAnimationProps) {
  return (
    <span
      className={cn(
        `relative inline-flex ${AGENT_ICON_SIZE} shrink-0 items-center justify-center`,
        className,
      )}
    >
      {active && (
        <span className="pointer-events-none absolute inset-x-0 -top-1 block h-3" aria-hidden="true">
          {BUBBLE_PARTICLES.map((bubble, index) => (
            <span
              key={index}
              className="agent-bubble"
              style={{
                left: bubble.left,
                width: bubble.size,
                height: bubble.size,
                animationDelay: bubble.delay,
              }}
            />
          ))}
        </span>
      )}
      <Icon
        className={cn(`${AGENT_ICON_SIZE} text-foreground`, active && 'animate-[pulse_2s_ease-in-out_infinite]')}
        aria-hidden="true"
      />
    </span>
  );
}

export const bubblesBrainAnimation: AgentAnimationStrategy = {
  key: 'bubbles-brain',
  label: 'Bubbles from brain',
  Component: BubblesBrainAnimation,
};
