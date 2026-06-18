import { describe, it, expect } from 'vitest';
import { getAgentAnimation, DEFAULT_AGENT_ANIMATION_KEY } from './registry';
import { spinAnimation } from './animations/spin';
import { bubblesBrainAnimation } from './animations/bubblesBrain';
import { typingBubbleAnimation } from './animations/typingBubble';

describe('agent animation registry', () => {
  it('resolves a known key to its registered strategy', () => {
    expect(getAgentAnimation('spin')).toBe(spinAnimation);
    expect(getAgentAnimation('bubbles-brain')).toBe(bubblesBrainAnimation);
    expect(getAgentAnimation('typing-bubble')).toBe(typingBubbleAnimation);
  });

  it('falls back to the default strategy for an empty key', () => {
    expect(getAgentAnimation('').key).toBe(DEFAULT_AGENT_ANIMATION_KEY);
  });

  it('falls back to the default strategy for an unknown key', () => {
    expect(getAgentAnimation('no-such-animation').key).toBe(DEFAULT_AGENT_ANIMATION_KEY);
  });

  it('uses the spin animation as the product default', () => {
    expect(DEFAULT_AGENT_ANIMATION_KEY).toBe(spinAnimation.key);
  });
});
