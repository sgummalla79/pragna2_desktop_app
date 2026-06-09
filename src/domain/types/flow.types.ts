/**
 * Domain types for Agent Flows — user-authored multi-agent pipelines.
 *
 * Frontend shapes for `/api/flows/*`. The backend serialises in snake_case;
 * `infrastructure/repositories/mappers/mapFlow.ts` translates at the boundary.
 *
 * Phase 1 (list + CRUD + YAML authoring + read-only canvas): the graph is
 * authored as YAML and rendered read-only from the server-parsed `nodes`/`edges`.
 * Interactive editing (graph→YAML, side panels, positions) is Phase 2 — see
 * `docs/TODO.md` TD-020.
 */

import type { EdgeConditionValue } from '@/constants/edgeConditions';

/** Routing condition on a flow edge. */
export type EdgeCondition = EdgeConditionValue;

/**
 * The kind of a flow node. `null` = an LLM **agent** node (carries the inline
 * agent definition); the string kinds are deterministic pass-through nodes.
 */
export type FlowNodeKind = 'mcp_connector' | 'decision' | 'knowledge_library' | null;

/** One node in a flow graph (`flow.nodes[]`). */
export interface FlowNode {
  id: string;
  /** Topological label edges reference (unique within the flow). */
  apiName: string;
  displayName: string | null;
  description: string | null;
  /** `null` = agent node; otherwise a deterministic node kind. */
  nodeKind: FlowNodeKind;
  /** Agent-node fields (null/empty for deterministic nodes). */
  userModelId: string | null;
  systemPrompt: string | null;
  outputSchema: Record<string, unknown> | null;
  /** Routing labels the node can emit. */
  emits: string[];
  /** Tool api_names bound to the node. */
  tools: string[];
}

/** One directed edge between nodes / graph boundaries (`flow.edges[]`).
 *  `fromNode`/`toNode` may be a node `apiName`, `__start__`, or `__end__`. */
export interface FlowEdge {
  id: string;
  fromNode: string;
  toNode: string;
  condition: EdgeCondition;
}

/** A flow the user owns (`GET /api/flows`). */
export interface Flow {
  id: string;
  /** URL-safe identifier, unique per user (YAML cross-refs + invocation route). */
  apiName: string;
  displayName: string;
  description: string | null;
  /** Whether the flow is loaded into the runtime. */
  enabled: boolean;
  /** User-facing `/slash` command name when exposed; else `null`. */
  slashApiName: string | null;
  /** Exposes the flow as a `/slash` command + an LLM tool on the default agent. */
  exposedAsSlash: boolean;
  /** Flow-level tuning + editor hints (e.g. `positions`). */
  metadata: Record<string, unknown>;
  /** Verbatim YAML source — the editor's source of truth. */
  definition: string | null;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/** Body for `POST /api/flows` (minimal create). */
export interface CreateFlowPayload {
  apiName: string;
  displayName: string;
  description?: string;
  metadata?: Record<string, unknown>;
  /** Optional starter YAML committed atomically with the row. */
  definition?: string;
}

/** Body for `PATCH /api/flows/{id}/slash-exposure`. */
export interface UpdateFlowSlashExposurePayload {
  slashApiName?: string;
  exposedAsSlash?: boolean;
  /** Force `slash_api_name` to NULL. */
  clearSlashApiName?: boolean;
}
