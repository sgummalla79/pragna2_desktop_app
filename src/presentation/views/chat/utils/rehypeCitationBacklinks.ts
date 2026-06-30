/**
 * rehype plugin — turn the backend `citations` report's in-text `[n]` markers
 * into clickable footnote backlinks (pragna2_desktop_app#99 Tier 3).
 *
 * The citations node emits a normal assistant markdown message: prose with
 * literal numbered markers `[1]`, `[2]`… followed by a `## References` section
 * (an ordered/unordered list of `[title](url)` sources). This plugin:
 *   1. finds the list under the "References" heading and tags each item
 *      `id="cite-ref-<n>"` (n by order), then
 *   2. rewrites each in-text `[n]` whose reference exists into an anchor
 *      `<a class="citation-backlink" href="#cite-ref-<n>">[n]</a>`.
 *
 * The actual scroll-to + highlight is handled in `MarkdownMessage`'s anchor
 * renderer (these `#`-fragment anchors are NOT external links). FE-only — it
 * relies on the BE's deterministic numbering (marker n ↔ the n-th cited source),
 * needs no new BE field, and degrades gracefully: with no References list, or a
 * marker with no matching item, the `[n]` is left as plain text.
 *
 * MUST be appended AFTER Streamdown's `defaultRehypePlugins` (like
 * `rehypeSketchon`) so it runs past the sanitizer (rehype-harden) and the
 * injected anchors survive.
 */
import type { Element, ElementContent, Root, Text } from 'hast';
import {
  CITATION_BACKLINK_CLASS,
  CITATION_BACKLINK_ID_PREFIX,
  CITATION_REFERENCES_HEADING,
} from '@/constants/markdown';

const HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
/** Never rewrite markers inside these — code spans/blocks and existing links. */
const SKIP_TAGS = new Set(['pre', 'code', 'a']);
/** Matches a numbered citation marker like `[12]`. */
const CITATION_MARKER = /\[(\d+)\]/g;

/** Concatenate all descendant text of a hast node. */
function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

/** The list (`ol`/`ul`) immediately following a "References" heading, or null. */
function findReferencesList(root: Root): Element | null {
  const kids = root.children;
  for (let i = 0; i < kids.length; i += 1) {
    const node = kids[i];
    if (node.type !== 'element' || !HEADING_TAGS.has(node.tagName)) continue;
    if (textOf(node).trim().toLowerCase() !== CITATION_REFERENCES_HEADING) continue;
    // The references list is the next ELEMENT sibling after the heading.
    for (let j = i + 1; j < kids.length; j += 1) {
      const sib = kids[j];
      if (sib.type !== 'element') continue;
      return sib.tagName === 'ol' || sib.tagName === 'ul' ? sib : null;
    }
  }
  return null;
}

/** The `<li>` element children of a list. */
function listItems(list: Element): Element[] {
  return list.children.filter(
    (c): c is Element => c.type === 'element' && c.tagName === 'li',
  );
}

/** Build an in-text backlink anchor for marker `n` carrying the literal label. */
function backlinkAnchor(n: number, label: string): Element {
  return {
    type: 'element',
    tagName: 'a',
    properties: {
      href: `#${CITATION_BACKLINK_ID_PREFIX}${n}`,
      className: [CITATION_BACKLINK_CLASS],
      'data-citation-backlink': String(n),
    },
    children: [{ type: 'text', value: label }],
  };
}

/** Split a text node into text + backlink-anchor parts. Returns the original
 *  node (single-element array) when it carries no resolvable marker. */
function splitMarkers(text: Text, isValid: (n: number) => boolean): ElementContent[] {
  const { value } = text;
  CITATION_MARKER.lastIndex = 0;
  const parts: ElementContent[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = CITATION_MARKER.exec(value)) !== null) {
    const n = Number(m[1]);
    if (!isValid(n)) continue; // unknown marker → leave it in the text run
    if (m.index > last) parts.push({ type: 'text', value: value.slice(last, m.index) });
    parts.push(backlinkAnchor(n, m[0]));
    last = m.index + m[0].length;
  }
  if (parts.length === 0) return [text];
  if (last < value.length) parts.push({ type: 'text', value: value.slice(last) });
  return parts;
}

/** Rewrite markers in every eligible text node under `node`, in place. Skips the
 *  references list itself and any code/link subtree. */
function linkify(
  node: Root | Element,
  refList: Element,
  isValid: (n: number) => boolean,
): void {
  const children = node.children as ElementContent[];
  for (let i = 0; i < children.length; i += 1) {
    const child = children[i];
    if (child.type === 'text') {
      const parts = splitMarkers(child, isValid);
      if (parts.length !== 1 || parts[0] !== child) {
        children.splice(i, 1, ...parts);
        i += parts.length - 1;
      }
    } else if (
      child.type === 'element' &&
      child !== refList &&
      !SKIP_TAGS.has(child.tagName)
    ) {
      linkify(child, refList, isValid);
    }
  }
}

/**
 * rehype transform that wires in-text `[n]` markers to their References items.
 *
 * @returns the unist transformer.
 */
export function rehypeCitationBacklinks() {
  return (tree: Root): void => {
    const refList = findReferencesList(tree);
    if (!refList) return; // no references → leave markers as plain text
    const items = listItems(refList);
    if (items.length === 0) return;
    items.forEach((li, i) => {
      li.properties = { ...(li.properties ?? {}), id: `${CITATION_BACKLINK_ID_PREFIX}${i + 1}` };
    });
    const max = items.length;
    linkify(tree, refList, (n) => n >= 1 && n <= max);
  };
}
