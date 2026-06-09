/**
 * Draw-time connection validity for the flow canvas. Passed to React
 * Flow's `isValidConnection`, so an invalid connection can't even be
 * dropped — the user gets immediate feedback instead of a server-side
 * rejection at Save.
 *
 * Rules mirror the backend graph contract:
 *  - no self-loops (a node can't edge to itself),
 *  - nothing connects INTO `__start__`,
 *  - nothing connects OUT OF any End instance (`__end__` / `__end__::n`),
 *  - no duplicate (source, sourceHandle) — each outbound port has at
 *    most one outgoing edge. Plain source-target dedupe is too strict
 *    on a branching agent because every port leaves the SAME source
 *    node; the handle id is what distinguishes them.
 *
 * The optional `excludeEdgeId` skips one edge from the duplicate check.
 * React Flow passes the in-flight edge through onReconnectStart at the
 * top of a reconnect drag; we stash its id in the store and pass it
 * here so the user can move that edge's endpoint to a DIFFERENT handle
 * on the SAME nodes (which produces the same source→target pair the old
 * edge already occupies). Without this, every "just change the side"
 * reconnect failed and React Flow snapped the endpoint back.
 */

import type { Connection, Edge } from 'reactflow';

import { isEndInstanceId, NODE_START, PORT_HANDLE_PREFIX } from './editorTypes';

export function isValidFlowConnection(
  edges: Edge[],
  conn: Connection,
  excludeEdgeId: string | null = null,
): boolean {
  const { source, target, sourceHandle } = conn;
  if (!source || !target) return false;
  if (source === target) return false;
  if (target === NODE_START) return false;
  // Block any outgoing edge from an End instance (every `__end__` /
  // `__end__::n` is terminal). End ids may have a `::n` suffix, so the
  // literal-id check from R3.7+ is too narrow.
  if (isEndInstanceId(source)) return false;
  // Dedupe semantics depend on the source handle's kind:
  //   - PORT handle (`port:<emit>` / `port:else`) → at most one edge per
  //     port. The port maps to a single branch label; two edges would
  //     fork the same routing intent.
  //   - non-port (omni side handle on a chat agent, or no handle) →
  //     dedupe on (source, target). Multiple edges from the same side
  //     handle to DIFFERENT targets is fine; a duplicate to the same
  //     target is noise the BE would collapse.
  const isPort = sourceHandle?.startsWith(PORT_HANDLE_PREFIX) ?? false;
  if (isPort) {
    if (
      edges.some(
        (e) =>
          e.id !== excludeEdgeId &&
          e.source === source &&
          e.sourceHandle === sourceHandle,
      )
    ) {
      return false;
    }
  } else {
    if (
      edges.some(
        (e) =>
          e.id !== excludeEdgeId &&
          e.source === source &&
          e.target === target,
      )
    ) {
      return false;
    }
  }
  return true;
}
