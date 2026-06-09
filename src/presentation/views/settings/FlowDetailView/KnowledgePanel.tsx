/**
 * Side-panel editor for a selected Knowledge node (RAG Rung 2).
 *
 * A Knowledge node references one or more knowledge libraries (defined at
 * Settings → Knowledge); every agent node DOWNSTREAM of it inherits the
 * knowledge tools (list/read/search) over them. Each is held as a snapshot of
 * the library's identity (`sourceLibraryId` + `slug` + `displayName`; never
 * the corpus). The knowledge analog of `ConnectorPanel`, minus per-tool
 * selection — a library is exposed whole.
 *
 * Ported from the web app's KnowledgePanel. Edits write to the Zustand store
 * only; nothing persists until Save.
 */

import { useMemo, useState } from 'react';
import { Library, Plus, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ROUTES } from '@/constants/routes';
import { useKnowledgeLibraries } from '@/presentation/hooks/knowledge/useKnowledgeLibraries';
import type { KnowledgeLibrary } from '@/domain/types/knowledge.types';
import { type EditorLibrary, type KnowledgeNodeData, NODE_TYPE_KNOWLEDGE } from './editorTypes';
import { useFlowEditorStore } from './useFlowEditorStore';

export function KnowledgePanel() {
  const node = useFlowEditorStore((s) =>
    s.nodes.find((n) => n.id === s.selectedNodeId && n.type === NODE_TYPE_KNOWLEDGE),
  );
  const updateLibraries = useFlowEditorStore((s) => s.updateLibraries);
  const deleteNode = useFlowEditorStore((s) => s.deleteNode);
  const selectNode = useFlowEditorStore((s) => s.selectNode);

  const { data: availableLibraries = [], isLoading } = useKnowledgeLibraries();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const data = node?.data as KnowledgeNodeData | undefined;
  const libraries = data?.libraries ?? [];

  const addable = useMemo(() => {
    const chosen = new Set(libraries.map((l) => l.sourceLibraryId));
    return availableLibraries.filter((l) => !chosen.has(l.id));
  }, [availableLibraries, libraries]);

  if (!node || !data) return null;
  const nodeId = node.id;

  function pickLibrary(library: KnowledgeLibrary) {
    if (libraries.some((l) => l.sourceLibraryId === library.id)) return;
    const next: EditorLibrary = {
      sourceLibraryId: library.id,
      slug: library.slug,
      displayName: library.name,
    };
    updateLibraries(nodeId, [...libraries, next]);
    setAddOpen(false);
  }

  function removeLibrary(libraryId: string) {
    updateLibraries(
      nodeId,
      libraries.filter((l) => l.sourceLibraryId !== libraryId),
    );
  }

  return (
    <>
      <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-white"
              aria-hidden="true"
            >
              <Library size={13} strokeWidth={2.2} />
            </span>
            <h2 className="text-sm font-semibold">Knowledge</h2>
          </div>
          <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => selectNode(null)}>
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <p className="text-[11px] text-muted-foreground">
            Every agent node downstream of this one can search these libraries (list / read /
            search_knowledge). The corpus stays on your account — only its identity travels with the
            flow.
          </p>

          <div className="space-y-2">
            <Label>Libraries</Label>
            {libraries.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">No libraries added yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {libraries.map((l) => (
                  <li
                    key={l.sourceLibraryId}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {l.displayName}
                      </span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">
                        {l.slug}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${l.displayName}`}
                      onClick={() => removeLibrary(l.sourceLibraryId)}
                    >
                      <X size={14} aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button variant="outline" size="sm" className="w-full" onClick={() => setAddOpen(true)}>
            <Plus size={14} aria-hidden="true" />
            Add a library
          </Button>
        </div>

        <div className="flex justify-center border-t border-border p-3">
          <Button
            variant="destructive"
            size="sm"
            className="text-white"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Delete knowledge node
          </Button>
        </div>
      </aside>

      {/* Add-library modal — pick one of your libraries. */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add knowledge library</DialogTitle>
            <DialogDescription>
              Pick one of your libraries. Create new ones under Settings → Knowledge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Your libraries</Label>
            {isLoading ? (
              <p className="text-[12px] text-muted-foreground">Loading…</p>
            ) : addable.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">
                No libraries to add. Create one under Settings → Knowledge.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {addable.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => pickLibrary(l)}
                      className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left transition hover:bg-muted/60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{l.name}</span>
                        <span className="block truncate font-mono text-[10px] text-muted-foreground">
                          {l.slug}
                        </span>
                      </span>
                      <Plus size={14} aria-hidden="true" className="shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <Link
              to={ROUTES.SETTINGS_KNOWLEDGE}
              className="text-[12px] text-primary underline-offset-2 hover:underline"
            >
              Manage libraries in Settings → Knowledge
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete this knowledge node?</DialogTitle>
            <DialogDescription>
              Downstream agents will lose access to its libraries. Edges connected to it will be
              removed too.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="text-white"
              onClick={() => {
                setConfirmDeleteOpen(false);
                deleteNode(nodeId);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
