import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttachmentChip } from './AttachmentChip';

describe('AttachmentChip', () => {
  it('renders the filename', () => {
    render(<AttachmentChip filename="report.pdf" contentType="application/pdf" />);
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('renders a remove button that fires onRemove and stops propagation', async () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(
      <AttachmentChip filename="a.png" contentType="image/png" onRemove={onRemove} onClick={onClick} />,
    );
    await userEvent.click(screen.getByLabelText('Remove a.png'));
    expect(onRemove).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled(); // stopPropagation
  });

  it('fires onClick when the chip body is clicked', async () => {
    const onClick = vi.fn();
    render(<AttachmentChip filename="a.png" contentType="image/png" onClick={onClick} />);
    await userEvent.click(screen.getByText('a.png'));
    expect(onClick).toHaveBeenCalled();
  });

  it('omits the remove button when onRemove is absent', () => {
    render(<AttachmentChip filename="a.png" contentType="image/png" />);
    expect(screen.queryByLabelText(/Remove/)).toBeNull();
  });
});
