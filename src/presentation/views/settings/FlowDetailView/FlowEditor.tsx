/**
 * Orchestrating component for the interactive visual flow editor.
 *
 * Renders the ReactFlow canvas (wired to the Zustand editor store), the node
 * palette, and the right-side selection panel (NodePanel / DecisionPanel /
 * ConnectorPanel / KnowledgePanel for the selected node by its kind;
 * EdgePanel for the selected edge). A Save button serialises the canvas to
 * YAML, validates it server-side, and persists by flow id.
 *
 * Hydration: on mount the store is seeded from `flow.definition` via
 * `buildEditorGraph`; an empty definition falls back to a fresh Start/End
 * graph (`newFlowGraph`) with `meta` seeded from the flow. The store is
 * `reset()` on unmount so a different flow opens clean.
 *
 * Ported from the web app's FlowEditorView. The top {@link FlowMetaBar} carries
 * the graph-meta fields (description, expose-as-/slash, slash name), the
 * enable/disable toggle, YAML import/export, and Save; the page composes the
 * whole editor via `<FlowEditor flow={flow} />`.
 */

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import ReactFlow, {
  Background,
  ConnectionMode,
  Controls,
  ReactFlowProvider,
  type Connection,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { cn } from '@/lib/utils';
import type { Flow } from '@/domain/types/flow.types';
import type { YamlError } from '@/domain/types/flowYaml.types';
import {
  useSaveFlowFromYamlById,
  useValidateFlowYaml,
} from '@/presentation/hooks/flows/useFlows';

import { FLOW_NODE_TYPES } from './canvasNodes';
import { FLOW_EDGE_TYPES } from './ConditionEdge';
import { ConnectorPanel } from './ConnectorPanel';
import { DecisionPanel } from './DecisionPanel';
import { EdgePanel } from './EdgePanel';
import { KnowledgePanel } from './KnowledgePanel';
import { NodePanel } from './NodePanel';
import { PalettePanel } from './PalettePanel';
import { buildEditorGraph } from './buildEditorGraph';
import { isValidFlowConnection } from './connectionRules';
import { graphToYaml } from './graphToYaml';
import { FlowMetaBar } from './FlowMetaBar';
import {
  NODE_TYPE_AGENT,
  NODE_TYPE_CONNECTOR,
  NODE_TYPE_DECISION,
  NODE_TYPE_KNOWLEDGE,
  newFlowGraph,
} from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

/** Grid step shared by snap-to-grid drag AND the visible Background dots. */
const GRID_SIZE = 20;

interface Props {
  flow: Flow;
}

function EditorInner({ flow }: Props) {
  const validateMutation = useValidateFlowYaml();
  const saveMutation = useSaveFlowFromYamlById();
  const isSaving = saveMutation.isPending || validateMutation.isPending;

  const nodes = useFlowEditorStore((s) => s.nodes);
  const edges = useFlowEditorStore((s) => s.edges);
  const meta = useFlowEditorStore((s) => s.meta);
  const dirty = useFlowEditorStore((s) => s.dirty);
  const selectedNodeId = useFlowEditorStore((s) => s.selectedNodeId);
  const selectedEdgeId = useFlowEditorStore((s) => s.selectedEdgeId);
  const onNodesChange = useFlowEditorStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowEditorStore((s) => s.onEdgesChange);
  const onConnect = useFlowEditorStore((s) => s.onConnect);
  const onReconnect = useFlowEditorStore((s) => s.onReconnect);
  const beginReconnect = useFlowEditorStore((s) => s.beginReconnect);
  const endReconnect = useFlowEditorStore((s) => s.endReconnect);
  const selectNode = useFlowEditorStore((s) => s.selectNode);
  const selectEdge = useFlowEditorStore((s) => s.selectEdge);
  const hydrate = useFlowEditorStore((s) => s.hydrate);
  const reset = useFlowEditorStore((s) => s.reset);
  const markClean = useFlowEditorStore((s) => s.markClean);

  const [errors, setErrors] = useState<YamlError[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Validator reading FRESH store state each call (React Flow captures the
  // isValidConnection reference at drag start, before onReconnectStart fires).
  const isValidConnection = useCallback((conn: Connection) => {
    const state = useFlowEditorStore.getState();
    return isValidFlowConnection(state.edges, conn, state.reconnectingEdgeId);
  }, []);

  // Seed the store from the flow's stored YAML (or a fresh Start/End canvas)
  // and seed meta from the flow when the definition is empty. Reset on
  // unmount so a different flow opens clean. Re-runs only when the flow id
  // changes (a stale-time refetch returning the same row must not clobber
  // in-progress edits).
  useEffect(() => {
    if (flow.definition && flow.definition.trim()) {
      hydrate(buildEditorGraph(flow.definition));
    } else {
      const fresh = newFlowGraph();
      fresh.meta = {
        ...fresh.meta,
        apiName: flow.apiName,
        displayName: flow.displayName,
        description: flow.description,
        slashApiName: flow.slashApiName,
        exposedAsSlash: flow.exposedAsSlash,
      };
      hydrate(fresh);
    }
    return () => reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.id]);

  const handleNodeClick: NodeMouseHandler = (_e, node) => {
    const hasPanel =
      node.type === NODE_TYPE_AGENT ||
      node.type === NODE_TYPE_CONNECTOR ||
      node.type === NODE_TYPE_DECISION ||
      node.type === NODE_TYPE_KNOWLEDGE;
    selectNode(hasPanel ? node.id : null);
  };

  const handleEdgeClick: EdgeMouseHandler = (_e, edge) => {
    selectEdge(edge.id);
  };

  async function handleSave() {
    setBanner(null);
    setErrors([]);
    const definition = graphToYaml(meta, nodes, edges);
    try {
      // Validate first — surface structured errors and skip the save when
      // the document is invalid.
      const result = await validateMutation.mutateAsync(definition);
      if (!result.valid) {
        setErrors(result.errors);
        return;
      }
      const { flow: saved, created } = await saveMutation.mutateAsync({
        flowId: flow.id,
        definition,
      });
      markClean();
      setBanner({
        kind: 'ok',
        text: created ? `Created "${saved.displayName}".` : `Saved "${saved.displayName}".`,
      });
    } catch {
      setBanner({ kind: 'err', text: 'Save failed unexpectedly.' });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar: graph-meta + enabled + YAML actions + Save. */}
      <FlowMetaBar
        flow={flow}
        dirty={dirty}
        isSaving={isSaving}
        onSave={() => void handleSave()}
      />

      {/* Banner / validation errors. */}
      {(banner || errors.length > 0) && (
        <div className="shrink-0 border-b border-border px-4 py-2">
          {(() => {
            const isErr = banner?.kind === 'err' || errors.length > 0;
            const tone = isErr ? 'bg-red-900' : 'bg-emerald-800';
            const summary =
              banner?.text ??
              (errors.length === 1 ? '1 issue blocking save' : `${errors.length} issues blocking save`);
            return (
              <div role="status" className={cn('rounded-md text-white', tone)}>
                <div className="flex items-center gap-2 px-3 py-2 text-sm">
                  {isErr && <AlertCircle size={16} aria-hidden="true" />}
                  <span className="font-medium">{summary}</span>
                </div>
                {errors.length > 0 && (
                  <ul className="space-y-1 border-t border-white/15 px-3 py-2 font-mono text-xs">
                    {errors.map((e, i) => (
                      <li key={i}>
                        <span className="text-white/70">{e.path || '(document)'}</span>
                        {' — '}
                        {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Palette + canvas + selection panel. */}
      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1 bg-background">
          <PalettePanel />
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onReconnect={onReconnect}
            onReconnectStart={(_e, edge) => beginReconnect(edge.id)}
            onReconnectEnd={() => endReconnect()}
            edgesUpdatable
            isValidConnection={isValidConnection}
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={() => {
              selectNode(null);
              selectEdge(null);
            }}
            nodeTypes={FLOW_NODE_TYPES}
            edgeTypes={FLOW_EDGE_TYPES}
            connectionMode={ConnectionMode.Loose}
            nodesConnectable
            nodesDraggable
            snapToGrid
            snapGrid={[GRID_SIZE, GRID_SIZE]}
            fitView
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background gap={GRID_SIZE} color="var(--color-border)" />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        </div>
        {/* Each panel returns null for a non-matching selection, so at most
            one aside shows for the current selection. */}
        {selectedNodeId && <NodePanel />}
        {selectedNodeId && <ConnectorPanel />}
        {selectedNodeId && <DecisionPanel />}
        {selectedNodeId && <KnowledgePanel />}
        {selectedEdgeId && !selectedNodeId && <EdgePanel />}
      </div>
    </div>
  );
}

/** The interactive visual flow editor for a single flow. */
export function FlowEditor({ flow }: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner flow={flow} />
    </ReactFlowProvider>
  );
}
