import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  /** The assistant message's markdown content (may be mid-stream/partial). */
  content: string;
  className?: string;
}

/**
 * Renders assistant markdown with Streamdown — incremental parsing tolerant of
 * partial/streaming input, plus Shiki code highlighting.
 *
 * `parseIncompleteMarkdown` lets unterminated markdown (an open code fence
 * mid-stream) render gracefully rather than flashing raw backticks. Structural
 * styling comes from Streamdown's own utility classes (generated via the
 * `@source` directive in `index.css`); colors resolve through our theme tokens.
 * Phase 1 intentionally omits KaTeX math and the sketchon diagram plugin —
 * see `docs/TODO.md`.
 */
export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  className,
}: MarkdownMessageProps) {
  return (
    <Streamdown
      parseIncompleteMarkdown
      className={cn(
        'max-w-none text-[15px] leading-relaxed text-foreground',
        '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
    >
      {content}
    </Streamdown>
  );
});
