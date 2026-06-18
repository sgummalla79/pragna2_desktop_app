import { cn } from '@/lib/utils';
import type { AgentAnimationProps, AgentAnimationStrategy } from '../AgentAnimation.types';
import { AGENT_ICON_SIZE } from '../constants';
import './typingBubble.css';

/** Horizontal positions of the three typing dots, with staggered delays. */
const DOTS = [
  { cx: 8.5, delay: '0s' },
  { cx: 12, delay: '0.16s' },
  { cx: 15.5, delay: '0.32s' },
];

/**
 * "Typing bubble" — a chat/speech bubble whose three dots bounce in sequence
 * while the agent works (the familiar typing indicator); the dots rest static
 * when idle. Self-contained (draws its own bubble), tinted with the theme
 * `--primary` via `text-primary`. The `Icon` prop is intentionally unused —
 * this animation defines its own mark.
 */
function TypingBubbleAnimation({ active, className }: AgentAnimationProps) {
  return (
    <span
      className={cn(`inline-flex ${AGENT_ICON_SIZE} shrink-0 items-center justify-center text-primary`, className)}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className={AGENT_ICON_SIZE} fill="none">
        <path
          d="M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4.2 3.2a.6.6 0 0 1-.96-.48V15.5H5A1.5 1.5 0 0 1 3.5 14V6A1.5 1.5 0 0 1 5 4.5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {DOTS.map((dot) => (
          <circle
            key={dot.cx}
            className={cn('typing-dot', active && 'typing-dot--active')}
            cx={dot.cx}
            cy="10"
            r="1.15"
            fill="currentColor"
            style={{ animationDelay: dot.delay }}
          />
        ))}
      </svg>
    </span>
  );
}

export const typingBubbleAnimation: AgentAnimationStrategy = {
  key: 'typing-bubble',
  label: 'Typing bubble',
  Component: TypingBubbleAnimation,
};
