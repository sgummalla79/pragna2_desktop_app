import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { saveBytes } from '@/infrastructure/platform';
import { isPdfType } from '@/constants/attachments';
import { useServices } from '@/presentation/providers/ServiceContext';
import { logger } from '@/infrastructure/logging/logger';
import type { Attachment } from '@/domain/types/attachment.types';

interface DocumentCardProps {
  attachment: Attachment;
  /** Open the document in the viewer. Not called when expired. */
  onOpen?: (attachment: Attachment) => void;
}

/**
 * A full-width card shown on an assistant turn for a generated document (e.g. a
 * `create_pdf` PDF): a clickable title region on the left opens the viewer, a
 * Download button at the right end saves the bytes. The display name drops the
 * `.pdf` extension so it reads like a title ("Platform Architecture"). Expired
 * documents render disabled. Faithful port of the web app's `DocumentCard`; the
 * one difference is that "open" routes through the desktop's existing
 * `AttachmentViewer` rather than a separate canvas pane.
 */
export function DocumentCard({ attachment, onOpen }: DocumentCardProps) {
  const { attachmentService } = useServices();
  const [downloading, setDownloading] = useState(false);

  const { expired, filename, contentType } = attachment;
  const name = filename.replace(/\.pdf$/i, '');
  const kindLabel = isPdfType(contentType) ? 'PDF' : 'Document';

  const handleDownload = async () => {
    if (expired || downloading) return;
    setDownloading(true);
    try {
      const blob = await attachmentService.fetchContent(attachment.id);
      // Native Save As in Tauri (the webview's `<a download>` is a no-op in
      // WKWebView); blob-anchor download in a plain browser. `saved === false`
      // means the user cancelled the dialog — not an error, so stay silent.
      const outcome = await saveBytes(blob, filename);
      if (outcome.saved) toast.success(`Saved ${name}`);
    } catch (err: unknown) {
      logger.fromError('attachment:download:failed', err, { id: attachment.id });
      toast.error(`Couldn’t save ${name}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5',
        expired ? 'border-border bg-muted/40 opacity-60' : 'border-border bg-card',
      )}
    >
      {/* Title region — opens the viewer. */}
      <button
        type="button"
        data-testid="document-card"
        disabled={expired || !onOpen}
        onClick={() => onOpen?.(attachment)}
        title={filename}
        aria-label={`Open ${name}`}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          expired || !onOpen ? 'cursor-default' : 'cursor-pointer',
        )}
      >
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-muted">
          <FileText size={18} aria-hidden="true" className="text-muted-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-foreground">
            {expired ? `[expired] ${name}` : name}
          </span>
          <span className="block text-[12px] text-muted-foreground">Document · {kindLabel}</span>
        </span>
      </button>

      <Button
        size="sm"
        disabled={expired || downloading}
        className="flex-shrink-0"
        onClick={handleDownload}
        aria-label={`Download ${name}`}
      >
        <Download size={14} aria-hidden="true" />
        {downloading ? 'Downloading…' : 'Download'}
      </Button>
    </div>
  );
}
