import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MessageActions } from './MessageActions';

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('MessageActions — assistant', () => {
  it('renders Regenerate + Copy and fires their handlers', async () => {
    const onRegenerate = vi.fn();
    render(<MessageActions role="assistant" content="hello" onRegenerate={onRegenerate} alwaysVisible />);
    await userEvent.click(screen.getByLabelText('Regenerate'));
    expect(onRegenerate).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello');
  });

  it('shows the regenerate-with-model menu only when given models', async () => {
    const onRegenerateWithModel = vi.fn();
    const { rerender } = render(
      <MessageActions role="assistant" content="x" onRegenerate={vi.fn()} alwaysVisible />,
    );
    expect(screen.queryByLabelText('Regenerate with…')).toBeNull();

    rerender(
      <MessageActions
        role="assistant"
        content="x"
        onRegenerate={vi.fn()}
        onRegenerateWithModel={onRegenerateWithModel}
        availableModels={[{ id: 'm1', displayName: 'Sonnet' }]}
        alwaysVisible
      />,
    );
    await userEvent.click(screen.getByLabelText('Regenerate with…'));
    await userEvent.click(screen.getByText('Sonnet'));
    expect(onRegenerateWithModel).toHaveBeenCalledWith('m1');
  });
});

describe('MessageActions — user', () => {
  it('renders Edit + Branch and fires handlers', async () => {
    const onEdit = vi.fn();
    const onBranch = vi.fn();
    render(<MessageActions role="user" onEdit={onEdit} onBranch={onBranch} alwaysVisible />);
    await userEvent.click(screen.getByLabelText('Edit'));
    expect(onEdit).toHaveBeenCalled();
    await userEvent.click(screen.getByLabelText('Branch'));
    expect(onBranch).toHaveBeenCalled();
  });

  it('hides Branch when showBranch is false', () => {
    render(<MessageActions role="user" onEdit={vi.fn()} onBranch={vi.fn()} showBranch={false} alwaysVisible />);
    expect(screen.queryByLabelText('Branch')).toBeNull();
  });
});
