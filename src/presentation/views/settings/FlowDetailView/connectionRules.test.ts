import { describe, it, expect } from 'vitest';
import type { Edge } from 'reactflow';
import { isValidFlowConnection } from './connectionRules';
import { NODE_START, NODE_END, portHandleFor } from './editorTypes';

const conn = (o: Partial<{ source: string; target: string; sourceHandle: string | null }>) => ({
  source: 'a',
  target: 'b',
  sourceHandle: null,
  targetHandle: null,
  ...o,
});

describe('isValidFlowConnection', () => {
  it('rejects missing endpoints + self-loops', () => {
    expect(isValidFlowConnection([], conn({ source: '', target: 'b' }))).toBe(false);
    expect(isValidFlowConnection([], conn({ source: 'a', target: 'a' }))).toBe(false);
  });

  it('rejects edges INTO __start__ and OUT OF an End instance', () => {
    expect(isValidFlowConnection([], conn({ source: 'a', target: NODE_START }))).toBe(false);
    expect(isValidFlowConnection([], conn({ source: NODE_END, target: 'b' }))).toBe(false);
    expect(isValidFlowConnection([], conn({ source: `${NODE_END}::2`, target: 'b' }))).toBe(false);
  });

  it('allows __start__ → node and node → __end__', () => {
    expect(isValidFlowConnection([], conn({ source: NODE_START, target: 'b' }))).toBe(true);
    expect(isValidFlowConnection([], conn({ source: 'a', target: NODE_END }))).toBe(true);
  });

  it('dedupes a non-port edge on (source, target)', () => {
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];
    expect(isValidFlowConnection(edges, conn({ source: 'a', target: 'b' }))).toBe(false);
    expect(isValidFlowConnection(edges, conn({ source: 'a', target: 'c' }))).toBe(true);
  });

  it('dedupes a port edge on (source, sourceHandle) — one edge per port', () => {
    const h = portHandleFor('passed');
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b', sourceHandle: h }];
    expect(isValidFlowConnection(edges, conn({ source: 'a', target: 'c', sourceHandle: h }))).toBe(false);
    expect(
      isValidFlowConnection(edges, conn({ source: 'a', target: 'c', sourceHandle: portHandleFor('failed') })),
    ).toBe(true);
  });

  it('excludeEdgeId lets a reconnect snap to a different handle on the same pair', () => {
    const edges: Edge[] = [{ id: 'e1', source: 'a', target: 'b' }];
    expect(isValidFlowConnection(edges, conn({ source: 'a', target: 'b' }), 'e1')).toBe(true);
  });

  describe('single-in-edge nodes (citations)', () => {
    const cite = new Set(['cite']);

    it('allows the first inbound edge into a single-in-edge node', () => {
      expect(
        isValidFlowConnection([], conn({ source: 'synth', target: 'cite' }), null, cite),
      ).toBe(true);
    });

    it('blocks a SECOND inbound edge into a single-in-edge node (from a different source)', () => {
      const edges: Edge[] = [{ id: 'e1', source: 'synth', target: 'cite' }];
      expect(
        isValidFlowConnection(edges, conn({ source: 'other', target: 'cite' }), null, cite),
      ).toBe(false);
    });

    it('does not constrain in-degree for nodes NOT in the set', () => {
      const edges: Edge[] = [{ id: 'e1', source: 'synth', target: 'agent_2' }];
      expect(
        isValidFlowConnection(edges, conn({ source: 'other', target: 'agent_2' }), null, cite),
      ).toBe(true);
    });

    it('lets a reconnect move the existing in-edge of a single-in-edge node (excludeEdgeId)', () => {
      const edges: Edge[] = [{ id: 'e1', source: 'synth', target: 'cite' }];
      expect(
        isValidFlowConnection(edges, conn({ source: 'synth2', target: 'cite' }), 'e1', cite),
      ).toBe(true);
    });

    it('still permits the citations node to fan OUT (only IN is constrained)', () => {
      const edges: Edge[] = [{ id: 'e1', source: 'synth', target: 'cite' }];
      expect(
        isValidFlowConnection(edges, conn({ source: 'cite', target: NODE_END }), null, cite),
      ).toBe(true);
    });
  });
});
