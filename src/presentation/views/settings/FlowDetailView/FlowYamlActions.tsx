/**
 * YAML import / export / view actions for the flow editor.
 *
 * - **Import** — opens a Sheet flyout for file-drop or paste; on a clean parse
 *   it replaces the canvas (`buildEditorGraph` → store `hydrate`) and marks dirty.
 * - **Export** — serialises the live canvas to `<api_name>.yaml` and downloads it.
 * - **YAML** — opens a read-only Sheet showing the current canvas serialised as YAML.
 *
 * Self-contained: reads the canvas via the Zustand store for export/view and
 * hydrates it for import, so the parent only places the buttons.
 */

import { useRef, useState } from 'react';
import { Download, Eye, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

/** Import / Export / View-YAML buttons (+ their Sheet flyouts) for the flow editor toolbar. */
export function FlowYamlActions({ apiName }: Props) {
  const hydrate = useFlowEditorStore((s) => s.hydrate);
  const markDirty = useFlowEditorStore((s) => s.markDirty);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Import sheet ──────────────────────────────────────────────────────────
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── YAML view sheet ───────────────────────────────────────────────────────
  const [yamlOpen, setYamlOpen] = useState(false);
  const [yamlText, setYamlText] = useState('');

  // ── Export ────────────────────────────────────────────────────────────────
  function handleExport() {
    const { meta, nodes, edges } = useFlowEditorStore.getState();
    const text = graphToYaml(meta, nodes, edges);
    const base = (apiName || FLOW_YAML_EXPORT_FALLBACK_NAME).trim();
    const blob = new Blob([text], { type: FLOW_YAML_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}${FLOW_YAML_FILE_EXT}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import helpers ────────────────────────────────────────────────────────
  function openImport() {
    setImportText('');
    setImportError(null);
    setImportOpen(true);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(typeof reader.result === 'string' ? reader.result : '');
      setImportError(null);
    };
    reader.onerror = () => setImportError(ERRORS.FLW_010.message);
    reader.readAsText(file);
  }

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

  // ── YAML view helper ──────────────────────────────────────────────────────
  function openYaml() {
    const { meta, nodes, edges } = useFlowEditorStore.getState();
    setYamlText(graphToYaml(meta, nodes, edges));
    setYamlOpen(true);
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
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={openYaml}
        title="View the current canvas as YAML"
      >
        <Eye size={13} aria-hidden="true" /> YAML
      </Button>

      {/* ── Import sheet ───────────────────────────────────────────────── */}
      <Sheet open={importOpen} onOpenChange={setImportOpen}>
        <SheetContent className="z-[400] sm:max-w-xl" overlayClassName="z-[399]">
          <SheetHeader>
            <SheetTitle>Import YAML</SheetTitle>
            <SheetDescription>
              Drop a <code>.yaml</code> file here, choose one, or paste a YAML
              document below. This replaces the current canvas — review it, then
              Save.
            </SheetDescription>
          </SheetHeader>

          {/* Hidden file input */}
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

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) readFile(file);
            }}
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-5 text-center text-sm transition',
              dragOver
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border bg-muted/20 text-muted-foreground',
            ].join(' ')}
          >
            <Upload size={20} aria-hidden="true" />
            <span>Drop a YAML file here</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose file…
            </Button>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              — or paste YAML —
            </span>
            <Textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder={`api_name: my-flow\ndisplay_name: My Flow\ndescription: …\nnodes: …`}
              rows={10}
              className="resize-y font-mono text-xs"
              aria-label="YAML document"
            />
            {importError && (
              <p role="alert" className="text-sm text-destructive">
                {importError}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setImportOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmImport}
              disabled={!importText.trim()}
            >
              Replace canvas
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── YAML view sheet ─────────────────────────────────────────────── */}
      <Sheet open={yamlOpen} onOpenChange={setYamlOpen}>
        <SheetContent className="z-[400] sm:max-w-xl" overlayClassName="z-[399]">
          <SheetHeader>
            <SheetTitle>Flow YAML</SheetTitle>
            <SheetDescription>
              Read-only view of the current canvas serialised as YAML. Use
              Export to download it, or Import to replace the canvas.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-background">
            <pre className="whitespace-pre-wrap break-all px-3 py-2 font-mono text-xs text-foreground">
              {yamlText}
            </pre>
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setYamlOpen(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExport}
            >
              <Download size={13} aria-hidden="true" className="mr-1" />
              Download
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
