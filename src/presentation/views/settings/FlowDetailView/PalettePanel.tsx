/**
 * Left-sidebar palette inside the flow editor canvas area. Lists the
 * draggable node entries (Agent, If/Else, MCP, Knowledge, End) — Start is
 * auto-placed by `newFlowGraph()` and intentionally absent here (LangGraph
 * has exactly one entry).
 *
 * Entries are click-to-add at the visible viewport centre (nudged off any
 * node already there). The floating tray can be dragged out of the way by
 * its header. The palette icon/colour table is inlined here (mirrors the one
 * in `canvasNodes.tsx`) to keep the desktop port to its nine files.
 */

import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Bot, Cable, CircleStop, GitBranch, GripVertical, Library } from 'lucide-react';
import { useReactFlow } from 'reactflow';

import { cn } from '@/lib/utils';
import { useFlowEditorStore } from './useFlowEditorStore';

type PaletteKey = 'agent' | 'decision' | 'mcp_connector' | 'knowledge_library' | 'end';

interface PaletteEntry {
  key: PaletteKey;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  description: string;
  iconTileClass: string;
  iconClass?: string;
}

/** Palette entries — colours mirror the on-canvas node cards (see
 *  `canvasNodes.tsx`). Drop preview parity: the tile a user sees in the
 *  palette is the chip they get on the resulting node. */
const PALETTE: ReadonlyArray<PaletteEntry> = [
  {
    key: 'agent',
    label: 'Agent',
    icon: Bot,
    description: 'An LLM call that produces content. One inbound, one outbound.',
    iconTileClass: 'bg-sky-500 text-white',
  },
  {
    key: 'decision',
    label: 'If / else',
    icon: GitBranch,
    description:
      'A deterministic router. Fed by one agent; routes its emitted label to a branch per condition (+ else). No LLM call.',
    iconTileClass: 'bg-amber-500 text-white',
  },
  {
    key: 'mcp_connector',
    label: 'MCP',
    icon: Cable,
    description: 'Exposes its MCP connectors’ tools to every node downstream. No LLM call; passes through.',
    iconTileClass: 'bg-violet-500 text-white',
  },
  {
    key: 'knowledge_library',
    label: 'Knowledge',
    icon: Library,
    description: 'Exposes its knowledge libraries (search/read) to every node downstream. No LLM call; passes through.',
    iconTileClass: 'bg-teal-500 text-white',
  },
  {
    key: 'end',
    label: 'End',
    icon: CircleStop,
    description: 'Terminator. A flow may have multiple Ends; all serialize to __end__.',
    iconTileClass: 'bg-rose-500 text-white',
  },
];

interface Props {
  /** Optional accessible label for the palette nav. */
  ariaLabel?: string;
}

/** Diagonal nudge applied when the drop point is occupied (a multiple of the
 *  editor's snap grid so the nudged point lands on a visible dot). */
const DROP_CASCADE_STEP = 40;
const DROP_OCCUPIED_DX = 120;
const DROP_OCCUPIED_DY = 40;

type Positioned = { position: { x: number; y: number } };

/** True if any existing node sits close enough to `point` to overlap it. */
function isOccupied(point: { x: number; y: number }, nodes: Positioned[]): boolean {
  return nodes.some(
    (n) =>
      Math.abs(n.position.x - point.x) < DROP_OCCUPIED_DX &&
      Math.abs(n.position.y - point.y) < DROP_OCCUPIED_DY,
  );
}

/** Step diagonally off `start` until the point is clear of existing nodes. */
export function findFreeSlot(
  start: { x: number; y: number },
  nodes: Positioned[],
): { x: number; y: number } {
  let p = start;
  for (let i = 0; i < 12 && isOccupied(p, nodes); i += 1) {
    p = { x: p.x + DROP_CASCADE_STEP, y: p.y + DROP_CASCADE_STEP };
  }
  return p;
}

export function PalettePanel({ ariaLabel = 'Add node' }: Props) {
  const addAgent = useFlowEditorStore((s) => s.addAgentNode);
  const addDecision = useFlowEditorStore((s) => s.addDecisionNode);
  const addMcpConnector = useFlowEditorStore((s) => s.addMcpConnectorNode);
  const addKnowledge = useFlowEditorStore((s) => s.addKnowledgeNode);
  const addEnd = useFlowEditorStore((s) => s.addEndNode);
  const reactFlow = useReactFlow();

  // Drag-to-reposition state. `position` is null until first moved.
  const navRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<{
    parentRect: DOMRect;
    pointerOffsetX: number;
    pointerOffsetY: number;
    navWidth: number;
    navHeight: number;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  function onHandlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const nav = navRef.current;
    const parent = nav?.offsetParent as HTMLElement | null;
    if (!nav || !parent) return;
    const navRect = nav.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dragStateRef.current = {
      parentRect,
      pointerOffsetX: e.clientX - navRect.left,
      pointerOffsetY: e.clientY - navRect.top,
      navWidth: navRect.width,
      navHeight: navRect.height,
    };
    setDragging(true);
    e.preventDefault();
  }

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: PointerEvent) {
      const s = dragStateRef.current;
      if (!s) return;
      const minVisible = 24;
      let x = e.clientX - s.parentRect.left - s.pointerOffsetX;
      let y = e.clientY - s.parentRect.top - s.pointerOffsetY;
      x = Math.max(minVisible - s.navWidth, Math.min(s.parentRect.width - minVisible, x));
      y = Math.max(0, Math.min(s.parentRect.height - minVisible, y));
      setPosition({ x, y });
    }
    function onUp() {
      setDragging(false);
      dragStateRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  /** Approximate half-size so the node's CENTRE lands at the drop point
   *  (React Flow positions a node by its top-left). */
  function nodeHalfSize(kind: PaletteKey) {
    return kind === 'end' ? { halfW: 48, halfH: 12 } : { halfW: 70, halfH: 18 };
  }

  /** Initial drop position in flow coords — the visible viewport centre,
   *  offset by half the node, nudged off any node already there. */
  function dropPosition(kind: PaletteKey): { x: number; y: number } {
    const { halfW, halfH } = nodeHalfSize(kind);
    const parent = navRef.current?.offsetParent as HTMLElement | null;
    const reactFlowEl = parent?.querySelector('.react-flow') as HTMLElement | null;
    const rect = reactFlowEl?.getBoundingClientRect();
    const centre = rect
      ? reactFlow.screenToFlowPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        })
      : { x: 400, y: 200 };
    const desired = { x: centre.x - halfW, y: centre.y - halfH };
    return findFreeSlot(desired, useFlowEditorStore.getState().nodes);
  }

  function onAdd(key: PaletteKey) {
    const pos = dropPosition(key);
    if (key === 'agent') addAgent(pos);
    else if (key === 'decision') addDecision(pos);
    else if (key === 'mcp_connector') addMcpConnector(pos);
    else if (key === 'knowledge_library') addKnowledge(pos);
    else addEnd(pos);
  }

  return (
    <nav
      ref={navRef}
      aria-label={ariaLabel}
      className={cn(
        'absolute z-10 flex w-fit flex-col gap-1 rounded-xl border border-border/60 bg-card/95 p-2.5 shadow-sm backdrop-blur-sm',
        position ? '' : 'left-3 top-3',
        dragging && 'select-none',
      )}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      <div
        onPointerDown={onHandlePointerDown}
        className={cn(
          'flex items-center gap-1.5 px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80',
          dragging ? 'cursor-grabbing' : 'cursor-grab',
        )}
        title="Drag to move the palette"
      >
        <GripVertical size={12} aria-hidden="true" className="opacity-60" />
        <h2 className="leading-none">Nodes</h2>
      </div>
      {PALETTE.map((entry) => {
        const Icon = entry.icon;
        return (
          <button
            key={entry.key}
            type="button"
            onClick={() => onAdd(entry.key)}
            title={entry.description}
            className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition group-hover:scale-[1.04]',
                entry.iconTileClass,
              )}
              aria-hidden="true"
            >
              <Icon size={18} strokeWidth={2.2} className={entry.iconClass} />
            </span>
            <span className="font-medium leading-none">{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
