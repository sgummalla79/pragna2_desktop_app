/**
 * rehype plugin — turn a ```` ```sketchon ```` fenced code block into a
 * `<sketchon-diagram>` custom element carrying the raw spec JSON, so Streamdown's
 * `components` map renders it with `<SketchonDiagram>`. This is the sketchon
 * parallel to how Streamdown renders ```` ```mermaid ```` natively.
 *
 * MUST be appended AFTER Streamdown's `defaultRehypePlugins` (the caller spreads
 * them first). Running last means:
 *   - it is past the sanitizer (rehype-harden), so harden cannot strip the
 *     custom element we introduce, and
 *   - whatever Shiki did to the code's children (plain text or highlighted
 *     spans) is irrelevant — we recover the spec by concatenating descendant
 *     text.
 *
 * The spec is rendered + sanitized later, inside `<SketchonDiagram>` (DOMPurify);
 * this plugin only relocates the raw text, it never trusts or injects markup.
 */
import { visit } from 'unist-util-visit';
import type { Element, ElementContent, Root } from 'hast';
import { SKETCHON_FENCE_LANG, SKETCHON_ELEMENT_TAG } from '@/constants/markdown';

/** Concatenate all descendant text — recovers the spec even through Shiki spans. */
function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

/** The class tokens on a hast element (className may be string or string[]). */
function classList(node: Element): string[] {
  const c = node.properties?.className;
  if (Array.isArray(c)) return c.map(String);
  if (typeof c === 'string') return c.split(/\s+/);
  return [];
}

/**
 * rehype transform that swaps ```` ```sketchon ```` `<pre><code>` blocks for a
 * `<sketchon-diagram spec="…">` element.
 *
 * @returns the unist transformer.
 */
export function rehypeSketchon() {
  const targetClass = `language-${SKETCHON_FENCE_LANG}`;
  return (tree: Root): void => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'pre' || !parent || typeof index !== 'number') return;
      const code = node.children.find(
        (c): c is Element =>
          c.type === 'element' &&
          c.tagName === 'code' &&
          classList(c).includes(targetClass),
      );
      if (!code) return;
      const spec = textOf(code).replace(/\n+$/, '');
      // Replace the whole <pre> with our custom element; harden already ran.
      parent.children[index] = {
        type: 'element',
        tagName: SKETCHON_ELEMENT_TAG,
        properties: { spec },
        children: [],
      } satisfies Element;
    });
  };
}
