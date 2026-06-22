import { lazy, Suspense, useEffect, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { isImageType, isPdfType } from '@/constants/attachments';
import type { Attachment } from '@/domain/types/attachment.types';
import { useOverlayTitleBarInset } from '@/presentation/hooks/useOverlayTitleBarInset';
import { saveBytes } from '@/infrastructure/platform';
import { logger } from '@/infrastructure/logging/logger';
import { useAttachmentBlob } from '../hooks/useAttachmentBlob';

// Lazily loaded so the heavy pdf.js bundle is fetched only when a PDF is actually
// viewed (and stays out of the synchronous module graph / main chunk).
const PdfCanvasViewer = lazy(() =>
  import('./PdfCanvasViewer').then((m) => ({ default: m.PdfCanvasViewer })),
);

interface AttachmentViewerProps {
  /** The attachment to view, or `null` (closed). */
  attachment: Attachment | null;
  onClose: () => void;
}

/**
 * Full-screen overlay that views a sent attachment. Fetches the bytes through
 * the authenticated client (`useAttachmentBlob`) and renders an image inline,
 * a PDF in an `<iframe>` (native webview viewer), or — for other types — a
 * download link. Closes on backdrop click or Escape.
 */
export function AttachmentViewer({ attachment, onClose }: AttachmentViewerProps) {
  const { url, blob, loading, error } = useAttachmentBlob(attachment?.id ?? null);
  const [saving, setSaving] = useState(false);
  // Clear the macOS overlay traffic lights (full-screen overlay, top-left
  // header). No-op off macOS-overlay chrome. Called before the early return to
  // keep hook order stable.
  const headerInset = useOverlayTitleBarInset();

  /**
   * Save the open attachment. Routes through the platform `saveBytes` (native
   * Save As in Tauri; blob-anchor download in a plain browser) — the prior bare
   * `<a download>` was a silent no-op in macOS WKWebView.
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

  useEffect(() => {
    if (!attachment) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [attachment, onClose]);

  if (!attachment) return null;

  const image = isImageType(attachment.contentType);
  const pdf = isPdfType(attachment.contentType);

  return (
    <div
      className="fixed inset-0 z-[700] flex flex-col bg-foreground/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-label={attachment.filename}
    >
      {/* Header. */}
      <div
        className="flex shrink-0 items-center gap-2 border-b border-border bg-popover px-4 py-2.5"
        style={headerInset}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {attachment.filename}
        </span>
        {blob && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-foreground hover:bg-accent disabled:opacity-60"
          >
            <Download size={13} aria-hidden /> {saving ? 'Saving…' : 'Download'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Body. */}
      <div
        className="flex min-h-0 flex-1 items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
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
            className="max-h-full max-w-full rounded-md object-contain"
          />
        ) : pdf && blob ? (
          <Suspense
            fallback={<Loader2 size={28} className="animate-spin text-muted" aria-hidden />}
          >
            <PdfCanvasViewer blob={blob} className="rounded-md" />
          </Suspense>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Preview isn’t available for this file type.
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Download size={14} aria-hidden /> {saving ? 'Saving…' : `Download ${attachment.filename}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
