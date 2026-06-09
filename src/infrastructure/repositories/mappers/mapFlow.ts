/** Boundary mappers for flows (snake_case API ↔ camelCase domain). */

import type { EdgeCondition, Flow, FlowEdge, FlowNode } from '@/domain/types/flow.types';
import { EDGE_CONDITIONS } from '@/constants/edgeConditions';

/** Inline-agent node wire shape (BE migration 0030 — agent def lives on the node;
 *  deterministic nodes leave the agent fields null/empty). */
export interface ApiFlowNodeResponse {
  id: string;
  api_name: string;
  display_name: string | null;
  description: string | null;
  node_kind: string | null;
  user_model_id: string | null;
  system_prompt: string | null;
  output_schema: Record<string, unknown> | null;
  emits: string[] | null;
  tools: string[] | null;
}

export interface ApiFlowEdgeResponse {
  id: string;
  from_node: string;
  to_node: string;
  condition: string;
}

export interface ApiFlowResponse {
  id: string;
  api_name: string;
  display_name: string;
  description: string | null;
  enabled: boolean;
  slash_api_name: string | null;
  exposed_as_slash: boolean;
  metadata: Record<string, unknown>;
  definition: string | null;
  nodes: ApiFlowNodeResponse[];
  edges: ApiFlowEdgeResponse[];
}

function mapNode(raw: ApiFlowNodeResponse): FlowNode {
  return {
    id: raw.id,
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    nodeKind: (raw.node_kind as FlowNode['nodeKind']) ?? null,
    userModelId: raw.user_model_id,
    systemPrompt: raw.system_prompt,
    outputSchema: raw.output_schema,
    emits: raw.emits ?? [],
    tools: raw.tools ?? [],
  };
}

function mapEdge(raw: ApiFlowEdgeResponse): FlowEdge {
  return {
    id: raw.id,
    fromNode: raw.from_node,
    toNode: raw.to_node,
    condition: (raw.condition as EdgeCondition) ?? EDGE_CONDITIONS.DEFAULT,
  };
}

/** Maps a raw API flow (with nodes + edges) to the domain `Flow`. */
export function mapFlow(raw: ApiFlowResponse): Flow {
  return {
    id: raw.id,
    apiName: raw.api_name,
    displayName: raw.display_name,
    description: raw.description,
    enabled: raw.enabled,
    slashApiName: raw.slash_api_name,
    exposedAsSlash: raw.exposed_as_slash,
    metadata: raw.metadata ?? {},
    definition: raw.definition,
    nodes: (raw.nodes ?? []).map(mapNode),
    edges: (raw.edges ?? []).map(mapEdge),
  };
}
