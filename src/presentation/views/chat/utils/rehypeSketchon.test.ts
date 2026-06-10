import { describe, it, expect } from 'vitest';
import type { Root, Element } from 'hast';
import { rehypeSketchon } from './rehypeSketchon';

/** Build a `<pre><code class="language-X">text</code></pre>` hast subtree. */
function preCode(lang: string, text: string): Element {
  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: { className: [`language-${lang}`] },
        children: [{ type: 'text', value: text }],
      },
    ],
  };
}

function run(tree: Root): Root {
  rehypeSketchon()(tree);
  return tree;
}

describe('rehypeSketchon', () => {
  it('replaces a ```sketchon block with a <sketchon-diagram spec> element', () => {
    const tree: Root = { type: 'root', children: [preCode('sketchon', '{"kind":"flow"}\n')] };
    run(tree);
    const node = tree.children[0] as Element;
    expect(node.tagName).toBe('sketchon-diagram');
    expect(node.properties).toEqual({ spec: '{"kind":"flow"}' });
    expect(node.children).toEqual([]);
  });

  it('recovers the spec text through nested (Shiki-like) spans', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: {},
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-sketchon'] },
              children: [
                { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: '{"a":' }] },
                { type: 'element', tagName: 'span', properties: {}, children: [{ type: 'text', value: '1}' }] },
              ],
            },
          ],
        },
      ],
    };
    run(tree);
    expect((tree.children[0] as Element).properties).toEqual({ spec: '{"a":1}' });
  });

  it('leaves non-sketchon code blocks untouched', () => {
    const tree: Root = { type: 'root', children: [preCode('js', 'const x = 1;')] };
    run(tree);
    expect((tree.children[0] as Element).tagName).toBe('pre');
  });
});
