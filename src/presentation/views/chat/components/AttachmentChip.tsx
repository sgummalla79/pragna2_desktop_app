import { FileText, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isImageType } from '@/constants/attachments';

interface AttachmentChipProps {
  filename: string;
  contentType: string;
  /** Object URL for an inline image thumbnail (pending preview or fetched blob). */
  previewUrl?: string;
  /** Upload in flight — shows a spinner and dims the chip. */
  uploading?: boolean;
  /** Upload failed — red tint. */
  errored?: boolean;
  /** When set, renders an ✕ remove button (composer staging only). */
  onRemove?: () => void;
  /** Optional click (e.g. open the viewer for a sent image/PDF). */
  onClick?: () => void;
}

/**
 * Compact file chip: an image thumbnail (when `previewUrl` + image type) or a
 * file-type icon, the filename, and an optional remove ✕ / click handler.
 * Used both for composer staging and for attachments on a sent message.
 */
export function AttachmentChip({
  filename,
  contentType,
  previewUrl,
  uploading,
  errored,
  onRemove,
  onClick,
}: AttachmentChipProps) {
  const image = isImageType(contentType);
  return (
    <div
      className={cn(
        'inline-flex max-w-[220px] items-center gap-2 rounded-lg border px-2 py-1.5 text-[12px]',
        errored ? 'border-destructive/50 bg-destructive/10' : 'border-border bg-card',
        uploading && 'opacity-70',
        onClick && 'cursor-pointer hover:bg-accent',
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      title={filename}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
        {uploading ? (
          <Loader2 size={13} className="animate-spin" aria-hidden />
        ) : image && previewUrl ? (
          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        ) : image ? (
          <ImageIcon size={13} aria-hidden />
        ) : (
          <FileText size={13} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{filename}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${filename}`}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X size={12} aria-hidden />
        </button>
      )}
    </div>
  );
}
