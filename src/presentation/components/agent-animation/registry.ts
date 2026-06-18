import type { AgentAnimationStrategy } from './AgentAnimation.types';
import { spinAnimation } from './animations/spin';
import { bubblesBrainAnimation } from './animations/bubblesBrain';
import { typingBubbleAnimation } from './animations/typingBubble';

/**
 * All available thinking-indicator animations. Register a new animation by
 * adding its strategy module here — call sites resolve by key and need no
 * changes (Open/Closed). Order is irrelevant; lookup is by `key`.
 */
const STRATEGIES: readonly AgentAnimationStrategy[] = [
  spinAnimation,
  bubblesBrainAnimation,
  typingBubbleAnimation,
];

/**
 * Product default when branding config selects no animation (or an unknown
 * key): the spinning agent icon (legacy behaviour). Branders can opt into
 * `bubbles-brain` via brand.config.json's `agentAnimation`.
 */
export const DEFAULT_AGENT_ANIMATION_KEY = spinAnimation.key;  // 'spin'

const BY_KEY: ReadonlyMap<string, AgentAnimationStrategy> = new Map(
  STRATEGIES.map((strategy) => [strategy.key, strategy]),
);

/**
 * Resolve the animation strategy for a config key, falling back to the product
 * default for an empty or unrecognised key. Always returns a strategy.
 */
export function getAgentAnimation(key: string): AgentAnimationStrategy {
  return BY_KEY.get(key) ?? BY_KEY.get(DEFAULT_AGENT_ANIMATION_KEY)!;
}
