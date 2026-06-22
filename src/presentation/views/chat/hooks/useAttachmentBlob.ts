import { useEffect, useState } from 'react';
import { useServices } from '@/presentation/providers/ServiceContext';
import { logger } from '@/infrastructure/logging/logger';

interface AttachmentBlobState {
  /** Object URL for the fetched bytes; `null` while loading / on error. Used for
   *  `<img>` rendering and the (browser-fallback) download anchor. */
  url: string | null;
  /** The raw fetched bytes; `null` while loading / on error. Used to render a
   *  PDF to canvas (pdf.js) and to drive the native "Save As". */
  blob: Blob | null;
  loading: boolean;
  error: boolean;
}

/**
 * Fetch an attachment's bytes through the authenticated client and expose both
 * an object URL (for `<img>` / download anchor) and the raw {@link Blob} (for
 * pdf.js canvas rendering + native save) — a bare URL can't be used directly
 * since the content endpoint requires a Bearer header. The object URL is revoked
 * on change/unmount. Passing `null` clears state (no fetch).
 */
export function useAttachmentBlob(attachmentId: string | null): AttachmentBlobState {
  const { attachmentService } = useServices();
  const [state, setState] = useState<AttachmentBlobState>({
    url: null,
    blob: null,
    loading: false,
    error: false,
  });

  useEffect(() => {
    if (!attachmentId) {
      setState({ url: null, blob: null, loading: false, error: false });
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ url: null, blob: null, loading: true, error: false });

    attachmentService
      .fetchContent(attachmentId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, blob, loading: false, error: false });
      })
      .catch((err: unknown) => {
        logger.fromError(
          'ATT_002:content',
          err instanceof Error ? err : new Error(String(err)),
        );
        if (!cancelled) setState({ url: null, blob: null, loading: false, error: true });
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId, attachmentService]);

  return state;
}
