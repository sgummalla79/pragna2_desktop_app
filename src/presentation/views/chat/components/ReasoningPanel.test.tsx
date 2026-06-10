import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReasoningPanel } from './ReasoningPanel';

describe('ReasoningPanel', () => {
  it('collapsed by default: shows a one-line summary, not the full trace label', () => {
    render(<ReasoningPanel reasoning={'First thought\nSecond thought'} />);
    expect(screen.getByText('First thought')).toBeInTheDocument();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('expands to reveal the full trace + Done on click', async () => {
    render(<ReasoningPanel reasoning={'line one\nline two'} />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
    expect(screen.getByText(/line one/)).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('mounts expanded when defaultOpen', () => {
    render(<ReasoningPanel reasoning="trace text" defaultOpen />);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });
});
