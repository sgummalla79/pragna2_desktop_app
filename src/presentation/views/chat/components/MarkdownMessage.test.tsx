import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
