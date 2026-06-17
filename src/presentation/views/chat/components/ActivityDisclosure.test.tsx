import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActivityDisclosure } from './ActivityDisclosure';

describe('ActivityDisclosure', () => {
  it('collapsed by default: shows the summary, hides the body + footer', () => {
    render(
      <ActivityDisclosure summary="Short summary">
        <span>hidden body</span>
      </ActivityDisclosure>,
    );
    expect(screen.getByText('Short summary')).toBeInTheDocument();
    expect(screen.queryByText('hidden body')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands on click: shows openLabel, the body, and the Done footer', async () => {
    render(
      <ActivityDisclosure summary="Sum" openLabel="Open label">
        <span>the body</span>
      </ActivityDisclosure>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Open label')).toBeInTheDocument();
    expect(screen.getByText('the body')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('shows a "Working…" footer while running', () => {
    render(
      <ActivityDisclosure summary="Sum" status="running" defaultOpen>
        <span>body</span>
      </ActivityDisclosure>,
    );
    expect(screen.getByText('Working…')).toBeInTheDocument();
    expect(screen.queryByText('Done')).toBeNull();
  });

  it('mounts expanded when defaultOpen', () => {
    render(
      <ActivityDisclosure summary="Sum" defaultOpen>
        <span>body</span>
      </ActivityDisclosure>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('falls back to the summary as the open header when no openLabel is given', async () => {
    render(
      <ActivityDisclosure summary="Only summary">
        <span>body</span>
      </ActivityDisclosure>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getAllByText('Only summary').length).toBeGreaterThan(0);
  });
});
