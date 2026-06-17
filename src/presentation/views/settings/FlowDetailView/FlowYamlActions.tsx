/**
 * YAML import / export actions for the flow editor.
 *
 * - **Export** serialises the current canvas (`graphToYaml`) and streams it to
 *   the user's downloads as `<api_name>.yaml` (falling back to a brand name).
 * - **Import** opens a modal to paste or file-drop a YAML document; on a clean
 *   parse it REPLACES the canvas (`buildEditorGraph` → store `hydrate`) and
 *   marks the editor dirty so the user reviews and Saves. A malformed document
 *   surfaces an inline error and leaves the canvas untouched.
 *
 * Self-contained: reads the canvas for export and hydrates it for import via the
 * Zustand store directly, so the parent only places the buttons.
 */

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ERRORS } from '@/constants/errors';
import {
  FLOW_YAML_ACCEPT,
  FLOW_YAML_EXPORT_FALLBACK_NAME,
  FLOW_YAML_FILE_EXT,
  FLOW_YAML_MIME,
} from '@/constants/flows';
import { logger } from '@/infrastructure/logging/logger';

import { buildEditorGraph } from './buildEditorGraph';
import { graphToYaml } from './graphToYaml';
import { useFlowEditorStore } from './useFlowEditorStore';

interface Props {
  /** The flow's api_name, used as the default export filename. */
  apiName: string;
}

/** Import / export buttons (+ the import modal) for the flow editor toolbar. */
export function FlowYamlActions({ apiName }: Props) {
  const hydrate = useFlowEditorStore((s) => s.hydrate);
  const markDirty = useFlowEditorStore((s) => s.markDirty);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  /** Serialise the live canvas and download it as `<api_name>.yaml`. */
  function handleExport() {
    // Read fresh store state at click time (avoids stale closures).
    const { meta, nodes, edges } = useFlowEditorStore.getState();
    const yamlText = graphToYaml(meta, nodes, edges);
    const base = (apiName || FLOW_YAML_EXPORT_FALLBACK_NAME).trim();
    const blob = new Blob([yamlText], { type: FLOW_YAML_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}${FLOW_YAML_FILE_EXT}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openImport() {
    setImportText('');
    setImportError(null);
    setImportOpen(true);
  }

  /** Read a picked file's text into the import textarea (best-effort by type;
   *  the parse guard in {@link confirmImport} is the real gate). */
  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(typeof reader.result === 'string' ? reader.result : '');
      setImportError(null);
    };
    reader.onerror = () => setImportError(ERRORS.FLW_010.message);
    reader.readAsText(file);
  }

  /** Parse the pasted/loaded YAML; on success replace the canvas + mark dirty. */
  function confirmImport() {
    try {
      const graph = buildEditorGraph(importText);
      hydrate(graph);
      markDirty();
      setImportOpen(false);
    } catch (err) {
      logger.fromError('FLW_010:import', err instanceof Error ? err : new Error(String(err)));
      setImportError(ERRORS.FLW_010.message);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={openImport}
        title="Replace the canvas with a YAML document"
      >
        <Upload size={13} aria-hidden="true" /> Import
      </Button>
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={handleExport}
        title="Download this flow as YAML"
      >
        <Download size={13} aria-hidden="true" /> Export
      </Button>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import YAML</DialogTitle>
            <DialogDescription>
              Paste a flow YAML document or choose a file. This replaces the
              current canvas — review it, then Save.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileInputRef}
            type="file"
            accept={FLOW_YAML_ACCEPT}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readFile(file);
              e.target.value = '';
            }}
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} aria-hidden="true" /> Choose file…
            </Button>
            <Textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder="api_name: my-flow&#10;display_name: My Flow&#10;description: …&#10;nodes: …"
              rows={12}
              className="resize-y font-mono text-xs"
              aria-label="YAML document"
            />
            {importError && (
              <p role="alert" className="text-sm text-destructive">
                {importError}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              onClick={confirmImport}
              disabled={!importText.trim()}
            >
              Replace canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
