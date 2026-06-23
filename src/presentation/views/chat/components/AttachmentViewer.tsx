import { lazy, Suspense, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { isImageType, isPdfType } from '@/constants/attachments';
import type { Attachment } from '@/domain/types/attachment.types';
import { useSheetResize } from '@/presentation/hooks/useSheetResize';
import { saveBytes } from '@/infrastructure/platform';
import { logger } from '@/infrastructure/logging/logger';
import { useAttachmentBlob } from '../hooks/useAttachmentBlob';

// Lazily loaded so the heavy pdf.js bundle is fetched only when a PDF is actually
// viewed (and stays out of the synchronous module graph / main chunk).
const PdfCanvasViewer = lazy(() =>
  import('./PdfCanvasViewer').then((m) => ({ default: m.PdfCanvasViewer })),
);

// Viewer-sheet sizing (px). Layout literals kept named per the no-hardcoding rule
// (mirrors the flow YAML editor sheet). The default is wider than the YAML
// editor's so a fit-to-width PDF page reads comfortably; `EDGE_INSET` matches the
// `SheetContent` right inset (`right-2.5` = 10px) so the right edge stays put
// while the left edge drags.
const VIEWER_SHEET_DEFAULT_WIDTH_PX = 860;
const VIEWER_SHEET_MIN_WIDTH_PX = 420;
const VIEWER_SHEET_EDGE_INSET_PX = 10;

interface AttachmentViewerProps {
  /** The attachment to view, or `null` (closed). */
  attachment: Attachment | null;
  onClose: () => void;
}

/**
 * Right-anchored slide-over panel that views a sent attachment — same Sheet
 * presentation as the flow YAML editor (a floating, resizable rounded box inset
 * from the window edges), not a full-screen takeover.
 *
 * Fetches the bytes through the authenticated client (`useAttachmentBlob`) and
 * renders an image inline, a PDF on a pdf.js canvas (`PdfCanvasViewer` — an
 * `<iframe>`/`blob:` PDF is blank in macOS WKWebView, see CF-036), or — for other
 * types — a download button. The left edge drags to resize; the built-in Sheet
 * close button / Escape / backdrop click closes it.
 */
export function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const { url, blob, loading, error } = useAttachmentBlob(attachment?.id ?? null);
  const [saving, setSaving] = useState(false);
  const { width, startResize } = useSheetResize(
    VIEWER_SHEET_DEFAULT_WIDTH_PX,
    VIEWER_SHEET_MIN_WIDTH_PX,
    VIEWER_SHEET_EDGE_INSET_PX,
  );

  const image = attachment ? isImageType(attachment.contentType) : false;
  const pdf = attachment ? isPdfType(attachment.contentType) : false;
  const kindLabel = pdf ? 'PDF' : image ? 'Image' : 'Document';

  /**
   * Save the open attachment. Routes through the platform `saveBytes` (native
   * Save As in Tauri; blob-anchor download in a plain browser) — a bare
   * `<a download>` is a silent no-op in macOS WKWebView (CF-037).
   */
  const handleSave = async () => {
    if (!blob || !attachment || saving) return;
    setSaving(true);
    try {
      const outcome = await saveBytes(blob, attachment.filename);
      if (outcome.saved) toast.success(`Saved ${attachment.filename}`);
    } catch (err: unknown) {
      logger.fromError('attachment:viewer:save:failed', err, { id: attachment.id });
      toast.error(`Couldn’t save ${attachment.filename}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        className="z-[400] gap-3 sm:max-w-none"
        overlayClassName="z-[399]"
        style={{ width }}
      >
        {/* Left-edge drag handle — horizontal resize. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize viewer"
          onPointerDown={startResize}
          className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize hover:bg-primary/40"
        />

        {attachment && (
          <>
            <SheetHeader>
              <SheetTitle className="truncate">{attachment.filename}</SheetTitle>
              <SheetDescription>{kindLabel}</SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border">
              {attachment.expired ? (
                <p className="text-sm text-muted-foreground">This file has expired.</p>
              ) : loading ? (
                <Loader2 size={28} className="animate-spin text-muted" aria-hidden />
              ) : error || !url ? (
                <p className="text-sm text-destructive">Couldn’t load this file.</p>
              ) : image ? (
                <img
                  src={url}
                  alt={attachment.filename}
                  className="max-h-full max-w-full object-contain"
                />
              ) : pdf && blob ? (
                <Suspense
                  fallback={
                    <Loader2 size={28} className="animate-spin text-muted" aria-hidden />
                  }
                >
                  <PdfCanvasViewer blob={blob} />
                </Suspense>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preview isn’t available for this file type.
                </p>
              )}
            </div>

            <SheetFooter className="sm:justify-start">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={saving || !blob}
              >
                <Download size={13} aria-hidden className="mr-1" />
                {saving ? 'Saving…' : 'Download'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
