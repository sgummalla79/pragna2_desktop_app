/**
 * Markdown text helpers for the chat surface.
 *
 * Used by ``MarkdownMessage`` (the Streamdown wrapper): assistant content is
 * run through :func:`normalizeMathDelimiters` before rendering so the
 * renderer stays provider-agnostic.
 */

/**
 * Normalise provider-specific LaTeX delimiters to the ``$`` / ``$$`` form
 * that remark-math (and therefore Streamdown's KaTeX pass) recognises.
 *
 * Models are inconsistent: some emit ``\( .. \)`` / ``\[ .. \]`` (Anthropic,
 * some OpenAI configs) while remark-math only parses ``$ .. $`` / ``$$ .. $$``.
 * Translating the backslash forms to dollar forms makes math render the same
 * regardless of which model produced it. This is the ONLY provider-variance
 * transform — everything else is plain GFM the renderer handles natively.
 *
 * Fenced and inline code are masked out first so a literal ``\(`` inside a
 * code sample is never rewritten as math.
 *
 * @param input - Raw assistant markdown.
 * @returns The markdown with LaTeX delimiters normalised to ``$`` / ``$$``;
 *   the input is returned unchanged when it is empty or contains no
 *   backslash-delimited math.
 */
export function normalizeMathDelimiters(input: string): string {
  if (!input) {
    return input;
  }

  // `@@n@@` is the mask token: a digit-wrapped sentinel that effectively
  // never appears in code or markdown, so masking and restoring are exact.
  const code: string[] = [];
  const masked = input.replace(
    /```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`/g,
    (match) => {
      code.push(match);
      return `@@${code.length - 1}@@`;
    },
  );

  // `\[ .. \]` -> `$$ .. $$` (display) and `\( .. \)` -> `$ .. $` (inline).
  // Function replacers avoid `$`-escaping pitfalls in the replacement.
  const converted = masked
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, body: string) => `$${body}$`);

  // Restore the masked code spans/blocks verbatim.
  return converted.replace(/@@(\d+)@@/g, (_, i: string) => code[Number(i)]);
}
