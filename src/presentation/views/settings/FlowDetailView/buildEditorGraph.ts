/**
 * Build the editable graph model (meta + nodes + edges) from a flow's
 * stored YAML `definition`. Used to seed the Zustand store when opening
 * an existing flow (or the starter template for a new flow).
 *
 * Layout is delegated to {@link yamlToGraph} (dagre + persisted
 * `metadata.positions` overrides); this module enriches each positioned
 * node with its full inline agent definition so the canvas + side-panel
 * can edit it. Edges are read straight from the YAML (split on the
 * comma fan-in/out syntax) so each carries its routing condition.
 */

import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

import { EDGE_CONDITIONS, type EdgeConditionValue } from '@/constants/edgeConditions';
import {
  type AgentNodeData,
  type BoundaryNodeData,
  type CitationsNodeData,
  type ConditionEdgeData,
  type ConnectorNodeData,
  type DecisionNodeData,
  type EditorAgent,
  type EditorConnector,
  type EditorLibrary,
  type FlowMeta,
  type KnowledgeNodeData,
  DISPATCH_MODE_PER_ITEM,
  EDGE_TYPE_CONDITION,
  NODE_END,
  NODE_KIND_CITATIONS,
  NODE_KIND_DECISION,
  NODE_KIND_KNOWLEDGE,
  NODE_KIND_MCP_CONNECTOR,
  NODE_START,
  NODE_TYPE_AGENT,
  NODE_TYPE_BOUNDARY,
  NODE_TYPE_CITATIONS,
  NODE_TYPE_CONNECTOR,
  NODE_TYPE_DECISION,
  NODE_TYPE_KNOWLEDGE,
  PORT_HANDLE_ELSE,
  blankAgent,
  isEndInstanceId,
  portHandleFor,
} from './editorTypes';
import { yamlToGraph } from './yamlToGraph';

type EditorNode = Node<
  | AgentNodeData
  | BoundaryNodeData
  | CitationsNodeData
  | ConnectorNodeData
  | DecisionNodeData
  | KnowledgeNodeData
>;
type EditorEdge = Edge<ConditionEdgeData>;

interface RawConnector {
  source_server_id?: string;
  url?: string;
  display_name?: string;
  selected_tools?: string[] | null;
}
interface RawLibrary {
  source_library_id?: string;
  slug?: string;
  display_name?: string;
}
/** A flow node in the inline-agent YAML shape (BE migration 0030 — no
 *  top-level `agents:` block). Agent nodes carry their definition
 *  directly; deterministic nodes (mcp_connector / decision) leave the
 *  agent fields absent and carry `connectors` / `conditions`. */
interface RawNode {
  api_name?: string;
  node_kind?: string | null;
  // Inline agent fields (agent nodes only).
  display_name?: string;
  description?: string | null;
  user_model?: string;
  system_prompt?: string;
  tools?: string[];
  emits?: string[];
  // Deterministic-node fields.
  connectors?: RawConnector[];
  libraries?: RawLibrary[];
  conditions?: string[];
  // Citations-node slot fields (all optional → BE defaults).
  sources_slot?: string;
  draft_slot?: string;
  output_slot?: string;
  // #26 slot wiring.
  inputs?: string[];
  outputs?: string[];
  reducers?: Record<string, string>;
}
interface RawEdge {
  from?: string;
  to?: string;
  condition?: string;
  // #35 dynamic fan-out (BE migration 0025). All three nullable; the
  // BE rejects half-set configurations at YAML validation + DB CHECK.
  dispatch_mode?: string | null;
  items_slot?: string | null;
  item_slot?: string | null;
}
interface RawDoc {
  api_name?: string;
  display_name?: string;
  description?: string | null;
  slash_api_name?: string | null;
  exposed_as_slash?: boolean;
  metadata?: Record<string, unknown>;
  flow?: { nodes?: RawNode[]; edges?: RawEdge[] };
}

/** Project an inline-agent flow node into the editor's `EditorAgent`. The
 *  node's `api_name` is the agent's identity (1-per-node, flow-local). */
function toAgent(raw: RawNode): EditorAgent {
  const apiName = raw.api_name ?? '';
  return {
    apiName,
    displayName: raw.display_name ?? apiName,
    description: raw.description ?? null,
    userModel: raw.user_model ?? '',
    systemPrompt: raw.system_prompt ?? '',
    tools: raw.tools ?? [],
    emits: raw.emits ?? [],
  };
}

export interface EditorGraph {
  meta: FlowMeta;
  nodes: EditorNode[];
  edges: EditorEdge[];
}

/** Parse a flow YAML string into the editable graph model. Best-effort:
 *  malformed YAML yields empty nodes/edges + whatever meta parsed. */
export function buildEditorGraph(yamlText: string): EditorGraph {
  let doc: RawDoc = {};
  try {
    const parsed = yaml.load(yamlText);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      doc = parsed as RawDoc;
    }
  } catch {
    /* keep doc = {} */
  }

  const meta: FlowMeta = {
    apiName: doc.api_name ?? '',
    displayName: doc.display_name ?? '',
    description: doc.description ?? null,
    slashApiName: doc.slash_api_name ?? null,
    exposedAsSlash: doc.exposed_as_slash ?? false,
    // Strip positions out of metadata — they're rebuilt from live node
    // coordinates on save, not carried as authored config.
    metadata: stripPositions(doc.metadata),
  };

  // Layout via the existing read-only projector (dagre + persisted
  // position overrides). Gives every node a coordinate.
  const positionsRaw = (doc.metadata?.positions ?? null) as
    | Record<string, { x: number; y: number }>
    | null;
  const laid = yamlToGraph(yamlText, positionsRaw);
  const positionById = new Map(laid.nodes.map((n) => [n.id, n.position]));

  const nodes: EditorNode[] = [];
  // Singleton Start boundary.
  const startPos = positionById.get(NODE_START) ?? positionsRaw?.[NODE_START];
  if (startPos) {
    nodes.push({
      id: NODE_START,
      type: NODE_TYPE_BOUNDARY,
      position: startPos,
      data: { boundary: NODE_START },
    });
  }

  // Multi-instance End boundaries (#33). The YAML only knows `__end__` as
  // a single sentinel; the per-instance `::n` ids are FE-only and live in
  // `metadata.positions`. So we scan the metadata directly (yamlToGraph
  // never sees the suffixed ids).
  const endIds = positionsRaw
    ? Object.keys(positionsRaw).filter(isEndInstanceId)
    : [];
  // Legacy flows: just one `__end__` (yamlToGraph adds it from the edges).
  if (endIds.length === 0 && positionById.has(NODE_END)) endIds.push(NODE_END);
  if (endIds.length === 0) endIds.push(NODE_END); // empty/new flow fallback
  for (const id of endIds) {
    nodes.push({
      id,
      type: NODE_TYPE_BOUNDARY,
      position: positionsRaw?.[id] ?? positionById.get(id) ?? { x: 720, y: 200 },
      data: { boundary: NODE_END },
    });
  }
  // Flow nodes — agent nodes (inline definition) or deterministic nodes.
  for (const n of doc.flow?.nodes ?? []) {
    if (!n.api_name) continue;

    // MCP Connector node — deterministic, no agent. Carries a snapshot of
    // each connector's identity (never the secret).
    if (n.node_kind === NODE_KIND_MCP_CONNECTOR) {
      const connectors: EditorConnector[] = (n.connectors ?? []).map((c) => ({
        sourceServerId: c.source_server_id ?? '',
        url: c.url ?? '',
        displayName: c.display_name ?? '',
        selectedTools: c.selected_tools ?? null,
      }));
      nodes.push({
        id: n.api_name,
        type: NODE_TYPE_CONNECTOR,
        position: positionById.get(n.api_name) ?? { x: 0, y: 0 },
        data: { nodeId: n.api_name, connectors },
      });
      continue;
    }

    // Knowledge node — deterministic, no agent. Carries a snapshot of each
    // library's identity (never the corpus).
    if (n.node_kind === NODE_KIND_KNOWLEDGE) {
      const libraries: EditorLibrary[] = (n.libraries ?? []).map((l) => ({
        sourceLibraryId: l.source_library_id ?? '',
        slug: l.slug ?? '',
        displayName: l.display_name ?? '',
      }));
      nodes.push({
        id: n.api_name,
        type: NODE_TYPE_KNOWLEDGE,
        position: positionById.get(n.api_name) ?? { x: 0, y: 0 },
        data: { nodeId: n.api_name, libraries },
      });
      continue;
    }

    // Citations node — deterministic, no agent. Resolves [[marker]] citations
    // from an upstream draft. Carries optional slot names (omitted → BE
    // defaults), no agent fields.
    if (n.node_kind === NODE_KIND_CITATIONS) {
      const data: CitationsNodeData = { nodeId: n.api_name };
      if (n.sources_slot) data.sourcesSlot = n.sources_slot;
      if (n.draft_slot) data.draftSlot = n.draft_slot;
      if (n.output_slot) data.outputSlot = n.output_slot;
      nodes.push({
        id: n.api_name,
        type: NODE_TYPE_CITATIONS,
        position: positionById.get(n.api_name) ?? { x: 0, y: 0 },
        data,
      });
      continue;
    }

    // Decision (router) node — deterministic, no agent. Carries its ordered
    // condition rows; the canvas renders one output port per row + else.
    if (n.node_kind === NODE_KIND_DECISION) {
      nodes.push({
        id: n.api_name,
        type: NODE_TYPE_DECISION,
        position: positionById.get(n.api_name) ?? { x: 0, y: 0 },
        data: { nodeId: n.api_name, conditions: n.conditions ?? [] },
      });
      continue;
    }

    // Agent node — the definition is inlined directly on the node
    // (BE migration 0030). Fall back to a blank agent for a node that
    // carries no agent fields yet (mid-author).
    const agent = n.display_name || n.user_model || n.system_prompt
      ? toAgent(n)
      : blankAgent(n.api_name);
    const data: AgentNodeData = { nodeId: n.api_name, agent };
    if (n.inputs?.length) data.inputs = n.inputs;
    if (n.outputs?.length) data.outputs = n.outputs;
    if (n.reducers && Object.keys(n.reducers).length) data.reducers = n.reducers;
    nodes.push({
      id: n.api_name,
      type: NODE_TYPE_AGENT,
      position: positionById.get(n.api_name) ?? { x: 0, y: 0 },
      data,
    });
  }

  // Persisted per-edge side-handle routing. The post-#33 key is
  // `source|sourceHandle|target`; legacy flows used `source|target`. Try
  // the new format first, then fall back so old saved flows still load.
  const edgeHandles = (doc.metadata?.edge_handles ?? {}) as Record<
    string,
    { source?: string; target?: string }
  >;
  // Multi-End round-trip (#33): retarget `to: __end__` edges back to the
  // specific End instance they attached to. Map key: `from|condition`.
  const endRouting = (doc.metadata?.end_routing ?? {}) as Record<string, string>;

  // A source "branches" iff it's a `decision` router node (agents are linear
  // now). For a branching source, the outbound edge's condition derives its
  // source handle id (`port:<condition>` / `port:else`).
  const decisionIds = new Set<string>();
  for (const n of nodes) {
    if (n.type === NODE_TYPE_DECISION) decisionIds.add(n.id);
  }

  // Edges: expand comma fan-in/out into one edge per (source, target).
  const declared = new Set(nodes.map((n) => n.id));
  const edges: EditorEdge[] = [];
  let counter = 0;
  for (const e of doc.flow?.edges ?? []) {
    if (!e.from || !e.to) continue;
    const condition = (e.condition ?? EDGE_CONDITIONS.DEFAULT) as EdgeConditionValue;
    const sources = String(e.from).split(',').map((s) => s.trim());
    const rawTargets = String(e.to).split(',').map((s) => s.trim());
    for (const source of sources) {
      if (!declared.has(source)) continue;
      // Compute source handle:
      //  - decision (router) → derive from condition (port:<x> or port:else)
      //  - agent / Start → persisted handle, else right (horizontal)
      const sourceIsBranching = decisionIds.has(source);
      let sourceHandle: string | undefined;
      if (sourceIsBranching) {
        sourceHandle =
          condition === EDGE_CONDITIONS.DEFAULT
            ? PORT_HANDLE_ELSE
            : portHandleFor(condition);
      }
      for (const rawTarget of rawTargets) {
        // Multi-End retarget: `to: __end__` may belong to any End
        // instance — let metadata.end_routing tell us which.
        let target = rawTarget;
        if (target === NODE_END) {
          const routed = endRouting[`${source}|${condition}`];
          if (routed && declared.has(routed)) target = routed;
        }
        if (!declared.has(target)) continue;
        // Look up persisted handle sides — new key first, then legacy.
        const handles =
          edgeHandles[`${source}|${sourceHandle ?? ''}|${target}`] ??
          edgeHandles[`${source}|${target}`];
        // Default handle ids:
        //  - source = Start → 'out' (its only handle)
        //  - source = branching agent → already set above
        //  - source = chat agent → persisted, else 'bottom' (legacy)
        //  - target = End instance → 'in' (its only handle)
        //  - target = non-End → persisted, else 'top' (legacy)
        const finalSourceHandle =
          sourceHandle ??
          handles?.source ??
          (source === NODE_START ? 'out' : 'bottom');
        const finalTargetHandle =
          handles?.target ?? (isEndInstanceId(target) ? 'in' : 'top');
        // #35: propagate dispatch fields when set. The BE guarantees
        // all-three-paired (or all NULL); read directly without
        // re-validating shape — invalid YAML is caught by the BE on
        // Save and surfaced as a structured 422.
        const data: ConditionEdgeData = { condition };
        if (e.dispatch_mode === DISPATCH_MODE_PER_ITEM) {
          data.dispatchMode = DISPATCH_MODE_PER_ITEM;
          if (e.items_slot) data.itemsSlot = e.items_slot;
          if (e.item_slot) data.itemSlot = e.item_slot;
        }
        edges.push({
          id: `e_${counter++}`,
          source,
          target,
          sourceHandle: finalSourceHandle,
          targetHandle: finalTargetHandle,
          type: EDGE_TYPE_CONDITION,
          data,
        });
      }
    }
  }

  return { meta, nodes, edges };
}

/** Return metadata without the editor's layout keys (`positions`,
 *  `edge_handles`, `end_routing`) — those are rebuilt from live canvas
 *  state on save, not authored config the user manages. */
function stripPositions(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!metadata) return {};
  const {
    positions: _positions,
    edge_handles: _edgeHandles,
    end_routing: _endRouting,
    ...rest
  } = metadata as Record<string, unknown>;
  return rest;
}
