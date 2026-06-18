import type { SVGProps } from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { bubblesBrainAnimation } from './bubblesBrain';

/** Minimal stand-in for the svgr agent icon component. */
const Icon = (props: SVGProps<SVGSVGElement>) => <svg data-testid="agent-icon" {...props} />;

describe('bubblesBrain animation', () => {
  const { Component } = bubblesBrainAnimation;

  it('always renders the agent icon', () => {
    const { getByTestId } = render(<Component active={false} Icon={Icon} />);
    expect(getByTestId('agent-icon')).toBeInTheDocument();
  });

  it('mounts the rising-bubble particles only while active', () => {
    const { container, rerender } = render(<Component active={false} Icon={Icon} />);
    expect(container.querySelectorAll('.agent-bubble')).toHaveLength(0);

    rerender(<Component active Icon={Icon} />);
    expect(container.querySelectorAll('.agent-bubble').length).toBeGreaterThan(0);
  });
});
