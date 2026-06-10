/**
 * Editor edge renderer for the visual flow canvas — a selectable connector
 * carrying a routing condition. The routing condition derives from which port
 * on the source Decision node the edge leaves; the visible edge shows a colour
 * cue + a small label when the condition is non-default. Selected edges get a
 * thicker stroke.
 *
 * Dynamic fan-out (#35) is carried in `data` and round-trips through
 * serialization; when set, the edge gets a dashed/thicker stroke + a small
 * read-only "per-item" chip. There is no UI here to toggle it (that lives in
 * the EdgePanel, which omits the dispatch editor in this port).
 */

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from 'reactflow';

import { EDGE_CONDITIONS, EDGE_CONDITION_COLORS } from '@/constants/edgeConditions';
import { type ConditionEdgeData, DISPATCH_MODE_PER_ITEM } from './editorTypes';

export function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
  selected,
}: EdgeProps<ConditionEdgeData>) {
  const condition = data?.condition ?? EDGE_CONDITIONS.DEFAULT;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const color =
    EDGE_CONDITION_COLORS[condition] ?? EDGE_CONDITION_COLORS[EDGE_CONDITIONS.DEFAULT];
  const hasLabel = condition !== EDGE_CONDITIONS.DEFAULT;
  // #35: read-only visual marker for dynamic fan-out (the data round-trips).
  const isDispatch = data?.dispatchMode === DISPATCH_MODE_PER_ITEM;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: color,
          strokeWidth: selected ? 2.5 : isDispatch ? 2 : 1.5,
          strokeDasharray: isDispatch ? '6 3' : undefined,
        }}
      />
      {(hasLabel || isDispatch) && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center gap-1"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {hasLabel && (
              <span
                className="rounded-md border bg-popover px-1.5 py-0.5 text-[10px] font-medium text-popover-foreground shadow"
                style={{ borderColor: color, color }}
              >
                {condition}
              </span>
            )}
            {isDispatch && (
              <span
                data-testid="dispatch-badge"
                className="rounded-md border border-primary bg-card px-1.5 py-0.5 text-[10px] font-medium text-primary shadow"
                title={`Dynamic fan-out: one parallel target invocation per item in "${data?.itemsSlot ?? '?'}".`}
              >
                per-item
              </span>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/** reactflow edge-type registry. */
export const FLOW_EDGE_TYPES = {
  condition: ConditionEdge,
} as const;
