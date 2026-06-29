/**
 * Serialise the visual editor's graph back into flow YAML — the inverse
 * of {@link yamlToGraph}. The result is POSTed to
 * `/api/flows[/{id}]/from-yaml`, which validates it and projects it into
 * the relational tables (flow + nodes + edges). The agent definition is
 * inlined on each node (BE migration 0030 — `user_agents` dropped, no
 * top-level `agents:` block).
 *
 * YAML is a derived artifact here, not a hand-edited source: the canvas
 * is the authoring surface and this function is the only writer.
 *
 * Node positions are emitted under `metadata.positions` (a
 * `{api_name: {x, y}}` map) so layout persists with the flow in the same
 * atomic save — no separate position-persistence call.
 */

import yaml from 'js-yaml';
import type { Edge, Node } from 'reactflow';

import { EDGE_CONDITIONS } from '@/constants/edgeConditions';
import {
  type AgentNodeData,
  type BoundaryNodeData,
  type CitationsNodeData,
  type ConditionEdgeData,
  type ConnectorNodeData,
  type DecisionNodeData,
  type FlowMeta,
  type KnowledgeNodeData,
  DISPATCH_MODE_PER_ITEM,
  NODE_END,
  NODE_KIND_CITATIONS,
  NODE_KIND_DECISION,
  NODE_KIND_KNOWLEDGE,
  NODE_KIND_MCP_CONNECTOR,
  NODE_TYPE_AGENT,
  NODE_TYPE_CITATIONS,
  NODE_TYPE_CONNECTOR,
  NODE_TYPE_DECISION,
  NODE_TYPE_KNOWLEDGE,
  PORT_HANDLE_ELSE,
  PORT_HANDLE_PREFIX,
  isEndInstanceId,
} from './editorTypes';

type EditorNode = Node<
  | AgentNodeData
  | BoundaryNodeData
  | CitationsNodeData
  | ConnectorNodeData
  | DecisionNodeData
  | KnowledgeNodeData
>;
type EditorEdge = Edge<ConditionEdgeData>;

/** The condition this edge carries, derived from which port it leaves.
 *
 *  - A branching agent's right-side ports have ids `port:<emit>` and
 *    `port:else`; `port:else` maps to `EDGE_CONDITIONS.DEFAULT`, every
 *    other port unwraps to its emit label.
 *  - A non-port source handle (chat agent's omni handles, Start's `out`,
 *    legacy edges) is unconditional → `EDGE_CONDITIONS.DEFAULT`. */
function deriveEdgeCondition(e: EditorEdge): string {
  const sh = e.sourceHandle ?? '';
  if (!sh.startsWith(PORT_HANDLE_PREFIX)) return EDGE_CONDITIONS.DEFAULT;
  if (sh === PORT_HANDLE_ELSE) return EDGE_CONDITIONS.DEFAULT;
  return sh.slice(PORT_HANDLE_PREFIX.length);
}

/** One serialised `flow.nodes:` entry for an agent node. The agent
 *  definition is inlined directly on the node (BE migration 0030 — no
 *  top-level `agents:` block). Optional keys are omitted when empty so
 *  the YAML stays clean and round-trips to defaults; #26 slot wiring
 *  (inputs/outputs/reducers) rides alongside. */
function nodeEntry(data: AgentNodeData): Record<string, unknown> {
  const a = data.agent;
  const entry: Record<string, unknown> = {
    api_name: data.nodeId,
    display_name: a.displayName,
    system_prompt: a.systemPrompt,
  };
  // `user_model` is optional: a blank model means "inherit the conversation's
  // selected model at run time" (BE resolves it — pragna2-tracker #184). Omit it
  // when empty so the YAML carries no model rather than an empty string.
  if (a.userModel) entry.user_model = a.userModel;
  if (a.description) entry.description = a.description;
  if (a.tools.length) entry.tools = [...a.tools];
  if (a.emits.length) entry.emits = [...a.emits];
  if (data.inputs?.length) entry.inputs = [...data.inputs];
  if (data.outputs?.length) entry.outputs = [...data.outputs];
  if (data.reducers && Object.keys(data.reducers).length) {
    entry.reducers = { ...data.reducers };
  }
  return entry;
}

/** One serialised `flow.nodes:` entry for an MCP Connector node. The
 *  connector snapshot carries identity only — the BE re-derives the
 *  secret at runtime from the user's account-level server row. */
function connectorNodeEntry(data: ConnectorNodeData): Record<string, unknown> {
  return {
    api_name: data.nodeId,
    node_kind: NODE_KIND_MCP_CONNECTOR,
    connectors: data.connectors.map((c) => ({
      source_server_id: c.sourceServerId,
      url: c.url,
      display_name: c.displayName,
      // Omit when "all tools" (null/empty) so the YAML stays clean; a strict
      // subset is emitted as `selected_tools`.
      ...(c.selectedTools && c.selectedTools.length > 0
        ? { selected_tools: c.selectedTools }
        : {}),
    })),
  };
}

/** One serialised `flow.nodes:` entry for a Knowledge node. Carries a snapshot
 *  of each library's identity only — the BE re-derives the corpus at runtime
 *  from the user's account-level library row by `source_library_id`. */
function knowledgeNodeEntry(data: KnowledgeNodeData): Record<string, unknown> {
  return {
    api_name: data.nodeId,
    node_kind: NODE_KIND_KNOWLEDGE,
    libraries: data.libraries.map((l) => ({
      source_library_id: l.sourceLibraryId,
      slug: l.slug,
      display_name: l.displayName,
    })),
  };
}

/** One serialised `flow.nodes:` entry for a Citations node. The three slot
 *  names are OPTIONAL — each is omitted when blank so the BE applies its
 *  canonical default (sources / draft / cited_report). The node carries nothing
 *  else: it is deterministic (no model / tools / emits / conditions). */
function citationsNodeEntry(data: CitationsNodeData): Record<string, unknown> {
  const entry: Record<string, unknown> = {
    api_name: data.nodeId,
    node_kind: NODE_KIND_CITATIONS,
  };
  if (data.sourcesSlot?.trim()) entry.sources_slot = data.sourcesSlot.trim();
  if (data.draftSlot?.trim()) entry.draft_slot = data.draftSlot.trim();
  if (data.outputSlot?.trim()) entry.output_slot = data.outputSlot.trim();
  return entry;
}

/** One serialised `flow.nodes:` entry for a Decision (router) node. Blank
 *  rows (mid-edit empties) are dropped so the persisted conditions are
 *  clean; the implicit `else` is never serialised here. */
function decisionNodeEntry(data: DecisionNodeData): Record<string, unknown> {
  return {
    api_name: data.nodeId,
    node_kind: NODE_KIND_DECISION,
    conditions: data.conditions.map((c) => c.trim()).filter((c) => c.length > 0),
  };
}

/**
 * Build the flow YAML document from the canvas graph.
 *
 * @param meta  Flow-level fields edited in the header form.
 * @param nodes React Flow nodes (agent nodes carry their inline agent
 *              definition; boundary nodes are skipped from `flow.nodes`
 *              but still contribute a position).
 * @param edges React Flow edges; `data.condition` drives routing.
 * @returns A YAML string ready for `/api/flows[/{id}]/from-yaml`.
 */
export function graphToYaml(
  meta: FlowMeta,
  nodes: EditorNode[],
  edges: EditorEdge[],
): string {
  const agentNodes = nodes.filter(
    (n): n is Node<AgentNodeData> => n.type === NODE_TYPE_AGENT,
  );
  const connectorNodes = nodes.filter(
    (n): n is Node<ConnectorNodeData> => n.type === NODE_TYPE_CONNECTOR,
  );
  const knowledgeNodes = nodes.filter(
    (n): n is Node<KnowledgeNodeData> => n.type === NODE_TYPE_KNOWLEDGE,
  );
  const citationsNodes = nodes.filter(
    (n): n is Node<CitationsNodeData> => n.type === NODE_TYPE_CITATIONS,
  );
  const decisionNodes = nodes.filter(
    (n): n is Node<DecisionNodeData> => n.type === NODE_TYPE_DECISION,
  );

  // Positions for EVERY node (incl. boundaries) so layout round-trips.
  const positions: Record<string, { x: number; y: number }> = {};
  for (const n of nodes) {
    positions[n.id] = {
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    };
  }

  // Per-edge side-handle routing. The key format depends on whether the
  // source is a branching node (a `decision` router — agents are linear now):
  //   - branching → `source|sourceHandle|target` (sourceHandle is a
  //     `port:*` id that distinguishes N+1 outbound edges from the same
  //     source); buildEditorGraph derives sourceHandle from condition.
  //   - agent / Start → legacy `source|target` (sourceHandle is the side
  //     the user dragged from; buildEditorGraph recovers it from here).
  // Both formats coexist in the same map; buildEditorGraph reads both.
  const branchingNodeIds = new Set(decisionNodes.map((n) => n.id));
  const edgeHandles: Record<string, { source?: string; target?: string }> = {};
  for (const e of edges) {
    if (!e.sourceHandle && !e.targetHandle) continue;
    const targetForKey = isEndInstanceId(e.target) ? NODE_END : e.target;
    const sourceBranches = branchingNodeIds.has(e.source);
    const key = sourceBranches
      ? `${e.source}|${e.sourceHandle ?? ''}|${targetForKey}`
      : `${e.source}|${targetForKey}`;
    edgeHandles[key] = {
      source: e.sourceHandle ?? undefined,
      target: e.targetHandle ?? undefined,
    };
  }

  // Multi-End round-trip (#33): the YAML `to: __end__` is ambiguous when
  // multiple End instances exist on the canvas. We record which canvas
  // End each terminating edge attaches to, keyed by `from|condition`.
  // buildEditorGraph reads this to re-route on reload; legacy flows
  // without this map fall back to the single original End.
  const endRouting: Record<string, string> = {};
  for (const e of edges) {
    if (!isEndInstanceId(e.target)) continue;
    if (e.target === NODE_END) continue; // single End — no entry needed
    const condition = deriveEdgeCondition(e);
    endRouting[`${e.source}|${condition}`] = e.target;
  }

  const metadata: Record<string, unknown> = { ...meta.metadata, positions };
  if (Object.keys(edgeHandles).length) metadata.edge_handles = edgeHandles;
  if (Object.keys(endRouting).length) metadata.end_routing = endRouting;

  const doc: Record<string, unknown> = {
    api_name: meta.apiName,
    display_name: meta.displayName,
  };
  if (meta.description) doc.description = meta.description;
  // Slash fields are written explicitly (not absent-tolerant here) — the
  // editor always knows the intended state. BE treats present values as
  // authoritative.
  if (meta.slashApiName) doc.slash_api_name = meta.slashApiName;
  doc.exposed_as_slash = meta.exposedAsSlash;
  doc.metadata = metadata;
  doc.flow = {
    nodes: [
      ...agentNodes.map((n) => nodeEntry(n.data)),
      ...connectorNodes.map((n) => connectorNodeEntry(n.data)),
      ...knowledgeNodes.map((n) => knowledgeNodeEntry(n.data)),
      ...citationsNodes.map((n) => citationsNodeEntry(n.data)),
      ...decisionNodes.map((n) => decisionNodeEntry(n.data)),
    ],
    edges: edges.map((e) => {
      const condition = deriveEdgeCondition(e);
      // Collapse any End id suffix back to the BE sentinel `__end__`.
      const to = isEndInstanceId(e.target) ? NODE_END : e.target;
      const entry: Record<string, unknown> = { from: e.source, to };
      if (condition !== EDGE_CONDITIONS.DEFAULT) entry.condition = condition;
      // #35 dynamic fan-out: write all three together when
      // dispatchMode is set, omit all three otherwise. The
      // all-three-paired invariant is enforced by the BE YAML
      // validator + DB CHECK; the inspector mirrors that contract
      // (the toggle controls all three), so a partial state here
      // would be a bug — write defensively even so.
      const data = e.data;
      if (
        data?.dispatchMode === DISPATCH_MODE_PER_ITEM
        && data.itemsSlot
        && data.itemSlot
      ) {
        entry.dispatch_mode = data.dispatchMode;
        entry.items_slot = data.itemsSlot;
        entry.item_slot = data.itemSlot;
      }
      return entry;
    }),
  };

  // `lineWidth: -1` disables line wrapping so long system prompts stay on
  // one logical line; `noRefs` avoids YAML anchors/aliases for repeated
  // structures (cleaner, human-readable output for the "view source").
  return yaml.dump(doc, { lineWidth: -1, noRefs: true });
}
