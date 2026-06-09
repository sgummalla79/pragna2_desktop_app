/**
 * Types for the visual flow editor (React Flow authoring).
 *
 * The editor's source of truth is a graph of React Flow nodes + edges
 * held in a Zustand store. Each agent node carries its agent definition
 * INLINE (the `user_agents` table was dropped in BE migration 0030 — the
 * definition lives directly on the flow node, no cross-flow sharing). On
 * Save the graph is serialised to YAML by
 * `graphToYaml` and persisted through the existing
 * `POST/PUT /api/flows[/{id}]/from-yaml` endpoint; YAML is never
 * hand-edited, only shown read-only via the "view source" dialog.
 */

import type { EdgeConditionValue } from '@/constants/edgeConditions';

/** Reserved graph-boundary node ids, shared with the backend YAML schema.
 *  Start is singleton (LangGraph has exactly one entry). End is the YAML
 *  sentinel; on the canvas multiple FE End instances may coexist
 *  (see endInstanceId() below) but all serialize to `to: __end__`. */
export const NODE_START = '__start__';
export const NODE_END = '__end__';

/** Multi-End: every End beyond the first carries a `::n` suffix on its FE
 *  node id (e.g. `__end__::2`). graphToYaml collapses suffixes back to
 *  `__end__`; buildEditorGraph rebuilds them from `metadata.end_routing`. */
const END_INSTANCE_SEPARATOR = '::';

/** Mint the next available End id given the End ids already on the canvas. */
export function nextEndInstanceId(existing: ReadonlySet<string>): string {
  if (!existing.has(NODE_END)) return NODE_END;
  let i = 2;
  while (existing.has(`${NODE_END}${END_INSTANCE_SEPARATOR}${i}`)) i += 1;
  return `${NODE_END}${END_INSTANCE_SEPARATOR}${i}`;
}

/** Whether a React-Flow node id refers to an End instance (any suffix). */
export function isEndInstanceId(id: string): boolean {
  return id === NODE_END || id.startsWith(`${NODE_END}${END_INSTANCE_SEPARATOR}`);
}

/** React Flow node `type` discriminators registered on the canvas. */
export const NODE_TYPE_AGENT = 'agent';
export const NODE_TYPE_BOUNDARY = 'boundary';
/** The MCP Connector node — a deterministic (non-LLM) node that declares
 *  MCP connectors; every agent node downstream of it inherits their tools.
 *  Serialises to a `node_kind: mcp_connector` YAML node. */
export const NODE_TYPE_CONNECTOR = 'connector';
/** The BE `node_kind` value an MCP Connector node serialises to. */
export const NODE_KIND_MCP_CONNECTOR = 'mcp_connector';
/** The Decision (router) node — a deterministic (non-LLM) node fed by exactly
 *  one upstream agent. It owns the branching: an author-defined ordered list of
 *  condition rows (each matched by equality against the agent's emitted label)
 *  plus an always-present `else`. Agents are linear and no longer branch.
 *  Serialises to a `node_kind: decision` YAML node. */
export const NODE_TYPE_DECISION = 'decision';
/** The BE `node_kind` value a Decision node serialises to. */
export const NODE_KIND_DECISION = 'decision';
/** The Knowledge node — a deterministic (non-LLM) node that declares knowledge
 *  libraries; every agent node downstream of it inherits the knowledge tools
 *  (list/read/search) over them. Serialises to a `node_kind: knowledge_library`
 *  YAML node. The knowledge analog of the MCP Connector node. */
export const NODE_TYPE_KNOWLEDGE = 'knowledge';
/** The BE `node_kind` value a Knowledge node serialises to. */
export const NODE_KIND_KNOWLEDGE = 'knowledge_library';

/** React Flow edge `type` for the connector (no inline picker post #33;
 *  edge condition derives from the source handle id for If/Else nodes). */
export const EDGE_TYPE_CONDITION = 'condition';

/** Source-handle id prefix on a branching agent's right-side ports. The
 *  segment after the prefix is the emit label, except `port:else` which
 *  maps to EDGE_CONDITIONS.DEFAULT (the always-fires else branch). */
export const PORT_HANDLE_PREFIX = 'port:';
export const PORT_HANDLE_ELSE = `${PORT_HANDLE_PREFIX}else`;
/** Build the source-handle id for a declared emit. */
export function portHandleFor(emit: string): string {
  return `${PORT_HANDLE_PREFIX}${emit}`;
}

/**
 * A flow-owned agent definition authored inline with its node. Mirrors
 * the inline agent fields on a `flow.nodes` entry (BE migration 0030 — no
 * top-level `agents:` block). `userModel` is the model's api_name (the FE
 * `Model.modelName`), which is what the YAML references.
 */
export interface EditorAgent {
  apiName: string;
  displayName: string;
  description: string | null;
  /** The user_model api_name (= `Model.modelName`) this agent runs on. */
  userModel: string;
  systemPrompt: string;
  tools: string[];
  emits: string[];
}

/** Data carried by an agent node on the canvas. */
export interface AgentNodeData {
  /** Short label unique within the flow (the YAML `api_name`). */
  nodeId: string;
  /** The inline, flow-owned agent definition this node runs. */
  agent: EditorAgent;
  /** #26 per-node context-shaping slots (optional). */
  inputs?: string[];
  outputs?: string[];
  reducers?: Record<string, string>;
}

/** Data carried by a `__start__` / `__end__` boundary node. */
export interface BoundaryNodeData {
  boundary: typeof NODE_START | typeof NODE_END;
}

/** One MCP connector declared on an MCP Connector node — a frozen SNAPSHOT
 *  of the account-level connector's identity (never the secret; the BE
 *  resolves credentials at runtime from the `mcp_connectors` row by
 *  `sourceServerId`). Downstream agent nodes inherit the connector's tools —
 *  all enabled tools by default, or only `selectedTools` when set. */
export interface EditorConnector {
  /** The `mcp_connectors` row id this snapshot was taken from. */
  sourceServerId: string;
  /** The connector's URL (portable identity key). */
  url: string;
  /** User-facing label, for display + export. */
  displayName: string;
  /** Per-tool selection (tool api_names). `null` / omitted = all of the
   *  connector's enabled tools. A strict subset narrows what downstream
   *  agents may call. Round-trips to the YAML `selected_tools` key. */
  selectedTools?: string[] | null;
}

/** Data carried by an MCP Connector node on the canvas. */
export interface ConnectorNodeData {
  /** Short label unique within the flow (the YAML `api_name`). */
  nodeId: string;
  /** The connectors this node exposes to all downstream agent nodes. */
  connectors: EditorConnector[];
}

/** One knowledge library declared on a Knowledge node — a frozen SNAPSHOT of
 *  the account-level library's identity (never the corpus; the BE resolves it
 *  at runtime from the `knowledge_libraries` row by `sourceLibraryId`).
 *  Downstream agent nodes gain search/read over it. Unlike a connector there
 *  is no per-tool selection — the whole library is exposed. */
export interface EditorLibrary {
  /** The `knowledge_libraries` row id this snapshot was taken from. */
  sourceLibraryId: string;
  /** The library's slug (portable identity key). */
  slug: string;
  /** User-facing label, for display + export. */
  displayName: string;
}

/** Data carried by a Knowledge node on the canvas. */
export interface KnowledgeNodeData {
  /** Short label unique within the flow (the YAML `api_name`). */
  nodeId: string;
  /** The libraries this node exposes to all downstream agent nodes. */
  libraries: EditorLibrary[];
}

/** Data carried by a Decision (router) node on the canvas. The condition
 *  labels are authored here (the `+`/`-` rows); each renders an output port
 *  (plus an always-on `else`) and is matched by equality against the single
 *  upstream agent's emitted label. */
export interface DecisionNodeData {
  /** Short label unique within the flow (the YAML `api_name`). */
  nodeId: string;
  /** Ordered match labels. Each becomes an output port; the implicit `else`
   *  (EDGE_CONDITIONS.DEFAULT) is rendered separately and never listed here. */
  conditions: string[];
}

/** Reserved virtual items_slot value: resolves to the latest user message
 *  rather than a real upstream-produced slot. Mirrors the BE's
 *  `SLOT_USER_QUERY` constant — kept in sync so the inspector's
 *  items_slot dropdown can offer it as a built-in option. */
export const SLOT_USER_QUERY = 'user_query';

/** Recognised dispatch_mode values. NULL/undefined means legacy single-edge
 *  routing; non-null opts the edge into LangGraph-`Send()`-based per-item
 *  dynamic fan-out (BE migration 0025, future-discussions #35). */
export const DISPATCH_MODE_PER_ITEM = 'per_item';
export type DispatchMode = typeof DISPATCH_MODE_PER_ITEM;

/** Data carried by a conditioned edge.
 *
 *  The three optional dispatch fields opt the edge into dynamic fan-out
 *  (#35). All three are set together or all undefined — the BE rejects a
 *  half-set configuration via a CHECK constraint AND the YAML validator,
 *  and the editor mirrors the contract in the inspector (the dispatch
 *  toggle controls all three at once).
 *
 *  At runtime FlowBuilder reads `state[itemsSlot]` and spawns one parallel
 *  invocation of the target node per item, binding the per-instance
 *  payload to the target's `itemSlot` input. */
export interface ConditionEdgeData {
  condition: EdgeConditionValue;
  /** Set to `'per_item'` to fan out one parallel target invocation per
   *  item in `itemsSlot`. Undefined ⇒ legacy routing. */
  dispatchMode?: DispatchMode;
  /** Name of the upstream slot to iterate, or the reserved
   *  `SLOT_USER_QUERY`. Required when `dispatchMode` is set. */
  itemsSlot?: string;
  /** Name of the slot the per-instance payload binds to on the receiving
   *  node's state. MUST be in the target node's `inputs`. Required when
   *  `dispatchMode` is set. */
  itemSlot?: string;
}

/** Flow-level metadata edited outside the canvas (header form). */
export interface FlowMeta {
  apiName: string;
  displayName: string;
  description: string | null;
  slashApiName: string | null;
  exposedAsSlash: boolean;
  /** Extra flow-level knobs (e.g. max_revisions). `positions` is added
   *  by the serialiser and should not be set here. */
  metadata: Record<string, unknown>;
}

/** A blank Agent (content-producing). */
export function blankAgent(apiName: string): EditorAgent {
  return {
    apiName,
    displayName: '',
    description: null,
    userModel: '',
    systemPrompt: '',
    tools: [],
    emits: [],
  };
}

/** The seed graph for a brand-new flow: just the Start/End boundary
 *  markers (so the author can wire to them). All four text-meta fields
 *  (apiName / displayName / description / slashApiName) start EMPTY so
 *  the author types real values into the placeholder-only inputs;
 *  required-ness is validated server-side on Save (the BE's
 *  POST /api/flows/from-yaml returns a 422 with structured errors which
 *  `handleSave` renders inline). `exposedAsSlash` stays default-on so
 *  the slash-name input is visible immediately. */
export function newFlowGraph(): {
  meta: FlowMeta;
  nodes: import('reactflow').Node<AgentNodeData | BoundaryNodeData | ConnectorNodeData | DecisionNodeData | KnowledgeNodeData>[];
  edges: import('reactflow').Edge<ConditionEdgeData>[];
} {
  return {
    meta: {
      apiName: '',
      displayName: '',
      description: null,
      slashApiName: null,
      exposedAsSlash: true,
      metadata: {},
    },
    // Only Start is auto-placed on a new flow. The author drops End(s)
    // from the palette when they wire the flow up; until then, save +
    // validate will surface "no terminal node" / "Start has no outgoing
    // edge" as YAML errors, which is the right place to remind them.
    // (Start is auto-placed because LangGraph has exactly one entry —
    // making it draggable would invite a dead state on the second drop.)
    nodes: [
      { id: NODE_START, type: NODE_TYPE_BOUNDARY, position: { x: 80, y: 200 }, data: { boundary: NODE_START } },
    ],
    edges: [],
  };
}
