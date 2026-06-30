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

  it('renders an inline numeric citation marker [1] as literal text when there is no References section', () => {
    // With no "## References" list, the inline `[1]` has nothing to link to, so
    // the renderer leaves it literal and does NOT turn it into an anchor.
    render(<MarkdownMessage content={'The sky is blue [1] at midday.\n\nplain paragraph.'} />);
    expect(screen.getByText(/\[1\]/)).toBeInTheDocument();
    expect(document.querySelector('a')).toBeNull();
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});

describe('MarkdownMessage — inline [n] citation backlinks (Tier 3)', () => {
  const REPORT = [
    'The sky is blue [1] and grass is green [2].',
    '',
    '## References',
    '',
    '1. [Sky color](https://example.com/sky)',
    '2. [Grass color](https://example.com/grass)',
  ].join('\n');

  beforeEach(() => {
    vi.clearAllMocks();
    openExternalMock.mockResolvedValue(undefined);
    // jsdom doesn't implement scrollIntoView — stub it so the click handler runs.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('turns each in-text [n] into an in-page backlink and tags the References items', () => {
    render(<MarkdownMessage content={REPORT} />);

    const back1 = document.querySelector('a[href="#cite-ref-1"]') as HTMLAnchorElement;
    const back2 = document.querySelector('a[href="#cite-ref-2"]') as HTMLAnchorElement;
    expect(back1).not.toBeNull();
    expect(back2).not.toBeNull();
    expect(back1.textContent).toBe('[1]');
    expect(back1).toHaveClass('citation-backlink');

    // The References items carry the matching ids.
    expect(document.querySelector('li#cite-ref-1')).not.toBeNull();
    expect(document.querySelector('li#cite-ref-2')).not.toBeNull();
  });

  it('clicking a backlink scrolls to + flashes its References item and never opens externally', () => {
    render(<MarkdownMessage content={REPORT} />);
    const back1 = document.querySelector('a[href="#cite-ref-1"]') as HTMLAnchorElement;
    const target = document.querySelector('li#cite-ref-1') as HTMLElement;

    const notPrevented = fireEvent.click(back1);
    expect(notPrevented).toBe(false); // preventDefault → no in-page hash navigation
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target).toHaveClass('citation-ref-flash');
    expect(openExternalMock).not.toHaveBeenCalled(); // backlink ≠ external link
  });

  it('still routes the References [title](url) links to the system browser', () => {
    render(<MarkdownMessage content={REPORT} />);
    const source = document.querySelector('a[href="https://example.com/sky"]') as HTMLAnchorElement;
    expect(source).not.toBeNull();
    fireEvent.click(source);
    expect(openExternalMock).toHaveBeenCalledWith('https://example.com/sky');
  });
});
