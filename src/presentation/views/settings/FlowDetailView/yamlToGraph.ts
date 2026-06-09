/**
 * Parse a flow YAML into reactflow-compatible nodes and edges,
 * laid out top-to-bottom with dagre.
 *
 * The viewer is read-only (R3.7): drag-to-author lives in the YAML
 * editor pane, not on the canvas. Parsing here is purely best-effort
 * preview — the server's `validate-yaml` endpoint is the authoritative
 * check.
 */
import dagre from 'dagre';
import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

/** Reserved graph boundary node ids understood by both ends. */
const NODE_START = '__start__';
const NODE_END = '__end__';

/** Default per-node box size used by dagre for layout. The actual
 *  React node may render larger; layout only cares about relative
 *  positioning. */
const NODE_WIDTH = 180;
const NODE_HEIGHT = 56;

interface ParsedNode {
  api_name: string;
  /** Inline agent label (BE migration 0030 — no top-level `agents:`
   *  block). Absent on deterministic nodes. */
  display_name?: string;
}

interface ParsedEdge {
  from?: string;
  to?: string;
  condition?: string;
}

interface ParsedDoc {
  flow?: {
    nodes?: ParsedNode[];
    edges?: ParsedEdge[];
  };
}

export interface YamlGraph {
  nodes: Node[];
  edges: Edge[];
}

/** Returns an empty graph when the YAML can't even be parsed at the
 *  top level. The editor falls back to "no preview" in that state. */
const EMPTY_GRAPH: YamlGraph = { nodes: [], edges: [] };

/** R10 #2: per-node manual overrides applied AFTER dagre lays out.
 *  Keyed on ``api_name`` so they survive any topology change that
 *  doesn't rename / remove the node. ``null`` map means "no overrides
 *  — use dagre output verbatim". */
export type PositionOverrides = Record<string, { x: number; y: number }> | null;

/**
 * Best-effort YAML → graph projection. Never throws — invalid YAML
 * returns an empty graph and the editor renders the validation
 * errors elsewhere.
 *
 * Now used only for its dagre node LAYOUT — the visual editor seeds node
 * positions from this (`buildEditorGraph`) and builds its own editable
 * edges. The edge list returned here is a legacy artifact kept for the
 * standalone tests; consumers read `nodes` (positions) only.
 *
 * Caller can pass ``positionOverrides`` to apply persisted user-drag
 * positions on top of the dagre layout. Nodes absent from the override
 * map keep their dagre coordinates so a newly-added node still appears
 * in the auto-laid graph.
 */
export function yamlToGraph(
  yamlText: string,
  positionOverrides: PositionOverrides = null,
): YamlGraph {
  if (!yamlText.trim()) return EMPTY_GRAPH;

  let parsed: unknown;
  try {
    parsed = yaml.load(yamlText);
  } catch {
    return EMPTY_GRAPH;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return EMPTY_GRAPH;
  }

  const doc = parsed as ParsedDoc;
  const nodes = doc.flow?.nodes ?? [];
  const edges = doc.flow?.edges ?? [];

  // Build the set of node ids referenced anywhere (declared + edge endpoints).
  // Edges may use comma-separated fan-out/fan-in syntax; split on commas.
  const declared = new Set<string>();
  for (const n of nodes) {
    if (n.api_name) declared.add(n.api_name);
  }
  const boundaries = new Set<string>();
  for (const e of edges) {
    for (const raw of [e.from, e.to]) {
      if (!raw) continue;
      for (const part of String(raw).split(',')) {
        const trimmed = part.trim();
        if (trimmed === NODE_START || trimmed === NODE_END) {
          boundaries.add(trimmed);
        }
      }
    }
  }

  // ── Build flat node + edge lists, then run dagre for positions ───────
  const reactNodes: Node[] = [];
  for (const id of boundaries) {
    reactNodes.push({
      id,
      data: { label: id === NODE_START ? '▶ Start' : '■ End' },
      position: { x: 0, y: 0 },
      type: 'default',
      sourcePosition: 'bottom' as Node['sourcePosition'],
      targetPosition: 'top' as Node['targetPosition'],
      // Read from --color-* tokens so the canvas follows palette swaps.
      // (Earlier versions used `--muted` without the prefix — that
      // doesn't match our Tailwind v4 naming, so it always fell back.)
      style: {
        background: 'var(--color-muted)',
        color: 'var(--color-muted-foreground)',
        border: '1px dashed var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
      },
    });
  }
  for (const n of nodes) {
    if (!n.api_name) continue;
    const subtitle = n.display_name ?? '';
    reactNodes.push({
      id: n.api_name,
      data: { label: subtitle ? `${n.api_name}\n${subtitle}` : n.api_name },
      position: { x: 0, y: 0 },
      type: 'default',
      sourcePosition: 'bottom' as Node['sourcePosition'],
      targetPosition: 'top' as Node['targetPosition'],
      style: {
        background: 'var(--color-card)',
        color: 'var(--color-card-foreground)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 12,
        whiteSpace: 'pre-line',
        textAlign: 'center' as const,
        minWidth: NODE_WIDTH,
      },
    });
  }

  // Edges: fan-out (a → b,c) becomes one edge per target; fan-in (a,b → c)
  // becomes one edge per source.
  const reactEdges: Edge[] = [];
  let edgeCounter = 0;
  for (const e of edges) {
    if (!e.from || !e.to) continue;
    const sources = String(e.from)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => declared.has(s) || s === NODE_START || s === NODE_END);
    const targets = String(e.to)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => declared.has(s) || s === NODE_START || s === NODE_END);
    for (const src of sources) {
      for (const dst of targets) {
        reactEdges.push({
          id: `e_${edgeCounter++}`,
          source: src,
          target: dst,
          // smoothstep routes orthogonally around the node boxes. (This
          // edge list is unused by the editor — see the function doc.)
          type: 'smoothstep',
          label: e.condition && e.condition !== 'default' ? e.condition : undefined,
          // SVG `fill` / `stroke` need real CSS color strings — we read
          // the same tokens the rest of the canvas uses so palette swaps
          // flow through edge styling too.
          labelStyle: { fill: 'var(--color-muted-foreground)', fontSize: 10 },
          labelBgStyle: { fill: 'var(--color-popover)' },
          style: { stroke: 'var(--color-border)', strokeWidth: 1.5 },
        });
      }
    }
  }

  // ── Auto-layout with dagre (top → bottom) ────────────────────────────
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of reactNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of reactEdges) {
    g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  for (const node of reactNodes) {
    const laid = g.node(node.id);
    if (laid) {
      // dagre returns center coords; reactflow expects top-left.
      node.position = { x: laid.x - NODE_WIDTH / 2, y: laid.y - NODE_HEIGHT / 2 };
    }
    // R10 #2: apply user override (if present) AFTER dagre. Unknown
    // node_ids in the override map are ignored — they refer to nodes
    // that have since been deleted or renamed in the YAML.
    const override = positionOverrides?.[node.id];
    if (override) {
      node.position = override;
    }
  }

  return { nodes: reactNodes, edges: reactEdges };
}
