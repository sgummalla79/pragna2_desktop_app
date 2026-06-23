/**
 * Editable flow-YAML sheet — opened from the editor toolbar's "YAML" button.
 *
 * Shows the current canvas serialised as YAML in a CodeMirror editor (YAML
 * grammar). Unlike the former read-only view, it supports an in-place fix loop:
 *   - **Validate** — POSTs the draft to `/api/flows/validate-yaml` and lists the
 *     structured errors by path (a collapsible {@link FlowYamlErrors} block), so
 *     an imported template's unresolved values (unknown `user_model`, …) can be
 *     spotted and corrected here.
 *   - **Apply to Canvas** — parses the edited YAML and replaces the canvas with
 *     it (marking the editor dirty). It does NOT save: some issues (e.g. a
 *     placeholder MCP connector id) can only be fixed in the node panels, so the
 *     author applies, finishes fixing on the canvas, then uses the editor's
 *     Save button (which validates + persists).
 *
 * The sheet is horizontally resizable (drag the left edge) so long YAML lines
 * are comfortable to edit; width is clamped to the viewport.
 */

import { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml } from '@codemirror/lang-yaml';
import { load as loadYaml } from 'js-yaml';
import { Check, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ERRORS } from '@/constants/errors';
import {
  FLOW_YAML_EXPORT_FALLBACK_NAME,
  FLOW_YAML_FILE_EXT,
  FLOW_YAML_MIME,
} from '@/constants/flows';
import type { YamlError } from '@/domain/types/flowYaml.types';
import { logger } from '@/infrastructure/logging/logger';
import { useValidateFlowYaml } from '@/presentation/hooks/flows/useFlows';
import { useSheetResize } from '@/presentation/hooks/useSheetResize';

import { buildEditorGraph } from './buildEditorGraph';
import { FlowYamlErrors } from './FlowYamlErrors';
import { useFlowEditorStore } from './useFlowEditorStore';

// Editor-sheet sizing (px). Layout literals kept named per the no-hardcoding
// rule; `EDGE_INSET` matches the `SheetContent` right inset (`right-2.5` = 10px)
// so the right edge stays put while the left edge drags.
const YAML_SHEET_DEFAULT_WIDTH_PX = 720;
const YAML_SHEET_MIN_WIDTH_PX = 420;
const YAML_SHEET_EDGE_INSET_PX = 10;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Flow api_name, used as the default Download filename. */
  apiName: string;
  /** Current-canvas YAML to seed the editor with when the sheet opens. */
  initialYaml: string;
}

/** Editable YAML editor sheet with inline validate + apply-to-canvas for a flow. */
export function FlowYamlEditorSheet({ open, onOpenChange, apiName, initialYaml }: Props) {
  const validateMutation = useValidateFlowYaml();
  const hydrate = useFlowEditorStore((s) => s.hydrate);
  const markDirty = useFlowEditorStore((s) => s.markDirty);

  const [draft, setDraft] = useState(initialYaml);
  const [errors, setErrors] = useState<YamlError[]>([]);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const { width: effectiveWidth, startResize } = useSheetResize(
    YAML_SHEET_DEFAULT_WIDTH_PX,
    YAML_SHEET_MIN_WIDTH_PX,
    YAML_SHEET_EDGE_INSET_PX,
  );

  const busy = validateMutation.isPending;

  // Seed the editor from the current canvas each time the sheet opens; clear
  // any prior validation state so a fresh session starts clean.
  useEffect(() => {
    if (open) {
      setDraft(initialYaml);
      setErrors([]);
      setBanner(null);
    }
  }, [open, initialYaml]);

  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  async function handleValidate() {
    setBanner(null);
    setErrors([]);
    try {
      const result = await validateMutation.mutateAsync(draft);
      if (result.valid) {
        setBanner({ kind: 'ok', text: 'Valid — no issues.' });
      } else {
        setErrors(result.errors);
      }
    } catch (err) {
      logger.fromError('flow-yaml-editor:validate', err instanceof Error ? err : new Error(String(err)));
      setBanner({ kind: 'err', text: 'Validation request failed.' });
    }
  }

  /**
   * Replace the canvas with the edited YAML — does NOT persist. Parsing is the
   * only gate here (the same buildEditorGraph used by Import); backend
   * validation errors are surfaced by Validate / the editor's Save button. This
   * is intentional so a document with issues that can only be fixed on the
   * canvas (e.g. a placeholder connector id) can still be applied and finished.
   */
  function handleApplyToCanvas() {
    setBanner(null);
    setErrors([]);
    // Guard the parse explicitly: buildEditorGraph SWALLOWS YAML syntax errors
    // (yielding an empty graph), which would silently wipe the canvas. Reject
    // malformed / non-mapping YAML here instead of clobbering it.
    let parsed: unknown;
    try {
      parsed = loadYaml(draft);
    } catch (err) {
      logger.fromError(
        'flow-yaml-editor:apply',
        err instanceof Error ? err : new Error(String(err)),
      );
      setBanner({ kind: 'err', text: ERRORS.FLW_010.message });
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setBanner({ kind: 'err', text: ERRORS.FLW_010.message });
      return;
    }
    hydrate(buildEditorGraph(draft));
    markDirty();
    onOpenChange(false);
  }

  function handleDownload() {
    const base = (apiName || FLOW_YAML_EXPORT_FALLBACK_NAME).trim();
    const blob = new Blob([draft], { type: FLOW_YAML_MIME });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}${FLOW_YAML_FILE_EXT}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="z-[400] sm:max-w-none"
        overlayClassName="z-[399]"
        style={{ width: effectiveWidth }}
      >
        {/* Left-edge drag handle — horizontal resize. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize YAML editor"
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-primary/40"
        />

        <SheetHeader>
          <SheetTitle>Flow YAML</SheetTitle>
          <SheetDescription>
            Edit the flow as YAML. Validate to surface issues by path, then Apply to Canvas to
            replace the canvas (fix any remaining issues there, then Save).
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
          <CodeMirror
            value={draft}
            onChange={setDraft}
            extensions={[yaml()]}
            theme={isDark ? 'dark' : 'light'}
            height="100%"
            style={{ height: '100%' }}
            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true }}
            aria-label="YAML editor"
          />
        </div>

        {banner && (
          <div
            role="status"
            className={banner.kind === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}
          >
            {banner.text}
          </div>
        )}
        <FlowYamlErrors errors={errors} />

        <SheetFooter className="sm:justify-between">
          <Button type="button" variant="ghost" size="sm" onClick={handleDownload}>
            <Download size={13} aria-hidden="true" className="mr-1" />
            Download
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleValidate()}
              disabled={busy || !draft.trim()}
            >
              <Check size={13} aria-hidden="true" className="mr-1" />
              Validate
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleApplyToCanvas}
              disabled={busy || !draft.trim()}
            >
              Apply to Canvas
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
