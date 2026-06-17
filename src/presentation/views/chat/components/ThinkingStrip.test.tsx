import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThinkingStrip } from './ThinkingStrip';

describe('ThinkingStrip', () => {
  it('idle: stays visible as a static "ready" logo with no status text', () => {
    render(<ThinkingStrip active={false} label={null} />);
    const strip = screen.getByTestId('thinking-strip');
    expect(strip).toBeInTheDocument(); // persists after a reply (does not vanish)
    expect(strip).toHaveAttribute('aria-label', 'Ready for your next message');
    expect(screen.queryByText('Thinking…')).toBeNull();
  });

  it('thinking: shows the live label and announces the working status', () => {
    render(<ThinkingStrip active label="Searching the web…" />);
    expect(screen.getByText('Searching the web…')).toBeInTheDocument();
    expect(screen.getByTestId('thinking-strip')).toHaveAttribute(
      'aria-label',
      'Agent status: Searching the web…',
    );
  });

  it('thinking with no label: falls back to the default working text', () => {
    render(<ThinkingStrip active label={null} />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });
});
