/**
 * Custom React Flow node renderers for the visual flow editor.
 *
 * Each node card shares the same neutral card body; its role is read off the
 * vivid colored icon-tile chip at the top-left (agent sky / decision amber /
 * connector violet / knowledge teal / start emerald / end rose). Selected nodes
 * get a solid foreground (white in dark) border highlight.
 *
 * Node shapes:
 *   - **Agent** (`AgentNode`) — linear; 4 omni handles (back-edge routing).
 *   - **Decision** (`DecisionNode`) — router: 1 left target + N+1 right
 *     `port:<condition>` + `port:else`; card auto-grows with the port count.
 *   - **MCP Connector** (`ConnectorNode`) — pass-through: 1 in, 1 out.
 *   - **Knowledge** (`KnowledgeNode`) — pass-through: 1 in, 1 out.
 *   - **Start** (singleton boundary) — single right-side `source` id 'out'.
 *   - **End** (multi-instance boundary) — single left-side `target` id 'in'.
 *
 * The palette icon/colour table is inlined here (and mirrored in
 * `PalettePanel.tsx`) so the desktop port keeps to the nine ported files —
 * the colours match the palette so dropping a node previews its card.
 */

import type { ComponentType } from 'react';
import { Bot, Cable, CircleStop, GitBranch, Library, Play } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  type AgentNodeData,
  type BoundaryNodeData,
  type ConnectorNodeData,
  type DecisionNodeData,
  type KnowledgeNodeData,
  NODE_START,
  PORT_HANDLE_ELSE,
  portHandleFor,
} from './editorTypes';
import { Handle, type NodeProps, Position } from 'reactflow';

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

interface NodeVisual {
  label: string;
  icon: IconComponent;
  /** Tailwind classes for the vivid icon tile. */
  iconTileClass: string;
  /** Optional transform on the icon glyph. */
  iconClass?: string;
}

/** Vivid icon-tile descriptors per node role — colours kept as in the source
 *  web app (agent sky / decision amber / connector violet / knowledge teal /
 *  start emerald / end rose). Mirrors `PALETTE` in `PalettePanel.tsx`. */
const VISUAL_AGENT: NodeVisual = { label: 'Agent', icon: Bot, iconTileClass: 'bg-sky-500 text-white' };
const VISUAL_DECISION: NodeVisual = {
  label: 'If / else',
  icon: GitBranch,
  iconTileClass: 'bg-amber-500 text-white',
};
const VISUAL_CONNECTOR: NodeVisual = {
  label: 'MCP',
  icon: Cable,
  iconTileClass: 'bg-violet-500 text-white',
};
const VISUAL_KNOWLEDGE: NodeVisual = {
  label: 'Knowledge',
  icon: Library,
  iconTileClass: 'bg-teal-500 text-white',
};
const VISUAL_START: NodeVisual = { label: 'Start', icon: Play, iconTileClass: 'bg-emerald-500 text-white' };
const VISUAL_END: NodeVisual = { label: 'End', icon: CircleStop, iconTileClass: 'bg-rose-500 text-white' };

// Faint handle dots that bump to full opacity on the parent's group-hover.
const HANDLE_CLASS =
  '!h-1 !w-1 !min-h-0 !min-w-0 !bg-muted-foreground opacity-30 transition-opacity group-hover:opacity-100';

// Uniform card body + selected-state highlight (theme-token aware).
const CARD_BASE = 'bg-card text-card-foreground border border-border';
const CARD_SELECTED = 'border-foreground ring-2 ring-foreground/40';

const NODE_ICON_TILE = 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-lg';
const NODE_RADIUS = 'rounded-2xl';
const NODE_ICON_SIZE = 11;

/** 4 omni-directional source+target handles (Loose-mode source can also
 *  receive). Each has a stable per-side id so chosen sides persist. */
function OmniHandles() {
  return (
    <>
      <Handle id="top" type="source" position={Position.Top} className={HANDLE_CLASS} />
      <Handle id="right" type="source" position={Position.Right} className={HANDLE_CLASS} />
      <Handle id="bottom" type="source" position={Position.Bottom} className={HANDLE_CLASS} />
      <Handle id="left" type="source" position={Position.Left} className={HANDLE_CLASS} />
    </>
  );
}

/** A node card: a rounded tile with a vivid icon square + title (+ subtitle). */
function MinimalCard({
  title,
  subtitle,
  Icon,
  iconTileClass,
  iconClass,
  selected,
}: {
  title: string;
  subtitle?: string;
  Icon: IconComponent;
  iconTileClass: string;
  iconClass?: string;
  selected: boolean;
}) {
  return (
    <div
      className={cn(
        'flex min-w-[80px] max-w-[140px] items-center gap-1.5 px-2 py-1.5 shadow-sm transition',
        NODE_RADIUS,
        CARD_BASE,
        selected && CARD_SELECTED,
      )}
    >
      <span className={cn(NODE_ICON_TILE, iconTileClass)} aria-hidden="true">
        <Icon size={NODE_ICON_SIZE} strokeWidth={2.2} className={iconClass} />
      </span>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold leading-tight">{title}</div>
        {subtitle && (
          <div className="truncate text-[9px] leading-tight text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </div>
  );
}

/** Agent node renderer — always linear, 4 omni handles. */
export function AgentNode({ data, selected }: NodeProps<AgentNodeData>) {
  const agent = data.agent;
  return (
    <div className="group">
      <MinimalCard
        title={agent.displayName || agent.apiName || data.nodeId}
        subtitle={VISUAL_AGENT.label}
        Icon={VISUAL_AGENT.icon}
        iconTileClass={VISUAL_AGENT.iconTileClass}
        iconClass={VISUAL_AGENT.iconClass}
        selected={!!selected}
      />
      <OmniHandles />
    </div>
  );
}

// Fixed geometry for the Decision card so the right-edge connectors line up
// with each row's vertical centre (card-relative placement, like Start).
const DECISION_PAD_T = 8; // p-2 top padding
const DECISION_HEAD_H = 20; // header row height (h-5)
const DECISION_ROW_H = 18; // each condition / else row (h-[18px])
const DECISION_GAP = 4; // gap-1 between flex children

/** Decision (router) node renderer — single inbound target on the left, one
 *  outbound source port per condition row + a permanent `else` port. The
 *  edge's condition is derived from which port it leaves. */
export function DecisionNode({ data, selected }: NodeProps<DecisionNodeData>) {
  const Icon = VISUAL_DECISION.icon;
  const conditions = (data.conditions ?? []).map((c) => c.trim()).filter((c) => c.length > 0);
  const rows: { label: string; handleId: string; isElse: boolean }[] = [
    ...conditions.map((label) => ({ label, handleId: portHandleFor(label), isElse: false })),
    { label: 'Else', handleId: PORT_HANDLE_ELSE, isElse: true },
  ];
  const rowCenterTop = (i: number) =>
    DECISION_PAD_T +
    DECISION_HEAD_H +
    DECISION_GAP +
    i * (DECISION_ROW_H + DECISION_GAP) +
    DECISION_ROW_H / 2;
  return (
    <div
      className={cn(
        'group relative flex w-fit min-w-[80px] max-w-[160px] flex-col gap-1 p-2 shadow-sm transition',
        NODE_RADIUS,
        CARD_BASE,
        selected && CARD_SELECTED,
      )}
    >
      <div className="flex h-5 items-center gap-1.5">
        <span className={cn(NODE_ICON_TILE, VISUAL_DECISION.iconTileClass)} aria-hidden="true">
          <Icon size={NODE_ICON_SIZE} strokeWidth={2.2} className={VISUAL_DECISION.iconClass} />
        </span>
        <span className="text-[11px] font-semibold leading-tight">{VISUAL_DECISION.label}</span>
      </div>

      <Handle id="in" type="target" position={Position.Left} className={HANDLE_CLASS} />

      {rows.map((r) => (
        <div
          key={r.handleId}
          className={cn(
            'flex h-[18px] items-center rounded-md px-2 text-[10px] leading-none',
            r.isElse ? 'bg-muted/40 italic text-muted-foreground' : 'bg-muted/60 text-foreground',
          )}
          title={r.isElse ? 'else (default — fires when no condition matched)' : r.label}
        >
          <span className="block w-full truncate text-right">{r.label}</span>
        </div>
      ))}

      {rows.map((r, i) => (
        <Handle
          key={`h-${r.handleId}`}
          id={r.handleId}
          type="source"
          position={Position.Right}
          className={HANDLE_CLASS}
          style={{ top: rowCenterTop(i) }}
        />
      ))}
    </div>
  );
}

/** MCP Connector node renderer — deterministic pass-through (1 in, 1 out). */
export function ConnectorNode({ selected }: NodeProps<ConnectorNodeData>) {
  return (
    <div className="group">
      <MinimalCard
        title={VISUAL_CONNECTOR.label}
        Icon={VISUAL_CONNECTOR.icon}
        iconTileClass={VISUAL_CONNECTOR.iconTileClass}
        iconClass={VISUAL_CONNECTOR.iconClass}
        selected={!!selected}
      />
      <Handle id="in" type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle id="out" type="source" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
}

/** Knowledge node renderer — deterministic pass-through (1 in, 1 out). */
export function KnowledgeNode({ selected }: NodeProps<KnowledgeNodeData>) {
  return (
    <div className="group">
      <MinimalCard
        title={VISUAL_KNOWLEDGE.label}
        Icon={VISUAL_KNOWLEDGE.icon}
        iconTileClass={VISUAL_KNOWLEDGE.iconTileClass}
        iconClass={VISUAL_KNOWLEDGE.iconClass}
        selected={!!selected}
      />
      <Handle id="in" type="target" position={Position.Left} className={HANDLE_CLASS} />
      <Handle id="out" type="source" position={Position.Right} className={HANDLE_CLASS} />
    </div>
  );
}

/** Boundary node renderer — Start (singleton, right source) or End
 *  (multi-instance, left target). */
export function BoundaryNode({ data, selected }: NodeProps<BoundaryNodeData>) {
  const isStart = data.boundary === NODE_START;
  const visual = isStart ? VISUAL_START : VISUAL_END;
  return (
    <div className="group">
      <MinimalCard
        title={visual.label}
        Icon={visual.icon}
        iconTileClass={visual.iconTileClass}
        iconClass={visual.iconClass}
        selected={!!selected}
      />
      {isStart ? (
        <Handle id="out" type="source" position={Position.Right} className={HANDLE_CLASS} />
      ) : (
        <Handle id="in" type="target" position={Position.Left} className={HANDLE_CLASS} />
      )}
    </div>
  );
}

/** reactflow node-type registry (keys match the editor node `type`s). */
export const FLOW_NODE_TYPES = {
  agent: AgentNode,
  boundary: BoundaryNode,
  connector: ConnectorNode,
  decision: DecisionNode,
  knowledge: KnowledgeNode,
} as const;
