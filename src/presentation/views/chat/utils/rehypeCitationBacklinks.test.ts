import { describe, it, expect } from 'vitest';
import type { Root, Element, ElementContent, Text } from 'hast';
import { rehypeCitationBacklinks } from './rehypeCitationBacklinks';

const text = (value: string): Text => ({ type: 'text', value });
const el = (
  tagName: string,
  children: ElementContent[] = [],
  properties: Record<string, unknown> = {},
): Element => ({ type: 'element', tagName, properties, children });

function run(tree: Root): Root {
  rehypeCitationBacklinks()(tree);
  return tree;
}

/** An ordered References list of `n` `[title](url)` items. */
function references(n: number): Element {
  const items = Array.from({ length: n }, (_unused, i) =>
    el('li', [el('a', [text(`Source ${i + 1}`)], { href: `https://e/${i + 1}` })]),
  );
  return el('ol', items);
}

const anchorsIn = (node: Element): Element[] =>
  node.children.filter(
    (c): c is Element => c.type === 'element' && c.tagName === 'a',
  );

describe('rehypeCitationBacklinks', () => {
  it('tags References items and converts in-text [n] into backlink anchors', () => {
    const tree: Root = {
      type: 'root',
      children: [
        el('p', [text('Alpha [1] and beta [2].')]),
        el('h2', [text('References')]),
        references(2),
      ],
    };
    run(tree);

    const ol = tree.children[2] as Element;
    expect((ol.children[0] as Element).properties?.id).toBe('cite-ref-1');
    expect((ol.children[1] as Element).properties?.id).toBe('cite-ref-2');

    const p = tree.children[0] as Element;
    const anchors = anchorsIn(p);
    expect(anchors).toHaveLength(2);
    expect(anchors[0].properties?.href).toBe('#cite-ref-1');
    expect(anchors[0].properties?.className).toEqual(['citation-backlink']);
    expect(anchors[0].properties?.['data-citation-backlink']).toBe('1');
    expect((anchors[0].children[0] as Text).value).toBe('[1]');
    expect(anchors[1].properties?.href).toBe('#cite-ref-2');
  });

  it('leaves an out-of-range marker as plain text', () => {
    const tree: Root = {
      type: 'root',
      children: [el('p', [text('Gamma [5].')]), el('h2', [text('References')]), references(2)],
    };
    run(tree);
    const p = tree.children[0] as Element;
    expect(anchorsIn(p)).toHaveLength(0);
    expect((p.children[0] as Text).value).toContain('[5]');
  });

  it('does nothing when there is no References section (markers stay literal)', () => {
    const tree: Root = { type: 'root', children: [el('p', [text('Delta [1].')])] };
    run(tree);
    const p = tree.children[0] as Element;
    expect(anchorsIn(p)).toHaveLength(0);
    expect((p.children[0] as Text).value).toBe('Delta [1].');
  });

  it('never rewrites markers inside code', () => {
    const tree: Root = {
      type: 'root',
      children: [
        el('p', [el('code', [text('[1]')])]),
        el('h2', [text('References')]),
        references(1),
      ],
    };
    run(tree);
    const code = (tree.children[0] as Element).children[0] as Element;
    expect(code.children[0].type).toBe('text');
    expect((code.children[0] as Text).value).toBe('[1]');
  });

  it('tags References items but does not linkify markers inside the References list itself', () => {
    const ol = el('ol', [el('li', [text('Item one [1]')])]);
    const tree: Root = {
      type: 'root',
      children: [el('p', [text('Eta [1].')]), el('h2', [text('References')]), ol],
    };
    run(tree);

    // The prose marker became a backlink…
    expect(anchorsIn(tree.children[0] as Element)).toHaveLength(1);
    // …but the marker inside the references item was left untouched (only id set).
    const li = ol.children[0] as Element;
    expect(li.properties?.id).toBe('cite-ref-1');
    expect(li.children.every((c) => c.type === 'text')).toBe(true);
  });
});
