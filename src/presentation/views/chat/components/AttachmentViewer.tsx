import { useEffect } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import { isImageType, isPdfType } from '@/constants/attachments';
import type { Attachment } from '@/domain/types/attachment.types';
import { useAttachmentBlob } from '../hooks/useAttachmentBlob';

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
  const { url, loading, error } = useAttachmentBlob(attachment?.id ?? null);

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
        onClick={(e) => e.stopPropagation()}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
          {attachment.filename}
        </span>
        {url && (
          <a
            href={url}
            download={attachment.filename}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[12px] text-foreground hover:bg-accent"
          >
            <Download size={13} aria-hidden /> Download
          </a>
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
        ) : pdf ? (
          <iframe
            src={`${url}#toolbar=0`}
            title={attachment.filename}
            className="h-full w-full rounded-md border-0 bg-background"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              Preview isn’t available for this file type.
            </p>
            <a
              href={url}
              download={attachment.filename}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] text-primary-foreground hover:bg-primary/90"
            >
              <Download size={14} aria-hidden /> Download {attachment.filename}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
