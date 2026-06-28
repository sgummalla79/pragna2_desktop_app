import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock only the opener transport; keep the real `isExternallyOpenableUrl` so the
// renderer's intercept decision is exercised for real.
const openExternalMock = vi.fn();
vi.mock('@/infrastructure/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/platform')>();
  return { ...actual, openExternal: (...a: unknown[]) => openExternalMock(...a) };
});

import { MarkdownMessage } from './MarkdownMessage';

describe('MarkdownMessage — blocked-link rendering', () => {
  it('renders a phantom sandbox: PDF link as clean text, not "[blocked]"', () => {
    // Models routinely emit a non-http(s) `sandbox:/mnt/data/*.pdf` link for a
    // generated PDF. rehype-harden blocks it; the default "indicator" policy
    // appends a literal " [blocked]". Our "text-only" override degrades it to
    // the plain child text instead.
    render(
      <MarkdownMessage content="You can [view and download it here](sandbox:/mnt/data/Q3_Status.pdf)." />,
    );
    expect(screen.getByText(/view and download it here/)).toBeInTheDocument();
    expect(screen.queryByText(/\[blocked\]/)).toBeNull();
    // The dead sandbox: href is not rendered as a working anchor.
    const anchor = document.querySelector('a[href^="sandbox:"]');
    expect(anchor).toBeNull();
  });

  it('keeps a legitimate https link clickable', () => {
    render(<MarkdownMessage content="See [the docs](https://example.com/guide)." />);
    const anchor = document.querySelector('a[href="https://example.com/guide"]');
    expect(anchor).not.toBeNull();
  });
});

describe('MarkdownMessage — external-open References links (pragna2_desktop_app#99)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    openExternalMock.mockResolvedValue(undefined);
  });

  it('routes an http(s) link click to the system browser and suppresses webview navigation', () => {
    render(<MarkdownMessage content="See [the docs](https://example.com/guide)." />);
    const anchor = document.querySelector(
      'a[href="https://example.com/guide"]',
    ) as HTMLAnchorElement;
    expect(anchor).not.toBeNull();

    // fireEvent.click returns false when the handler called preventDefault —
    // i.e. the default webview navigation was suppressed.
    const notPrevented = fireEvent.click(anchor);
    expect(notPrevented).toBe(false);
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/guide');
  });

  it('renders an inline numeric citation marker [1] as literal text, not a link', () => {
    // The BE emits inline citations as plain `[1]` text (no reference
    // definition), so the markdown renderer must leave it literal and NOT turn
    // it into an anchor. The clickable sources live in the "## References"
    // section as real `[title](url)` links.
    render(<MarkdownMessage content={'The sky is blue [1] at midday.\n\nplain paragraph.'} />);
    expect(screen.getByText(/\[1\]/)).toBeInTheDocument();
    expect(document.querySelector('a')).toBeNull();
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});
