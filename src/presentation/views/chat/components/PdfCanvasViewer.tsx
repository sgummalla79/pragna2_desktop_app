import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getDocument,
  type PDFDocumentProxy,
  type PDFDocumentLoadingTask,
} from '@/infrastructure/pdf/pdfjs';
import { logger } from '@/infrastructure/logging/logger';
import { cn } from '@/lib/utils';

/**
 * Fallback page aspect ratio (height / width) used to size a not-yet-rendered
 * page placeholder before its real dimensions are known — US Letter (11 / 8.5).
 * Mathematical layout constant; the real per-page ratio replaces it once the
 * page metadata loads.
 */
const DEFAULT_PAGE_ASPECT_RATIO = 11 / 8.5;

/** How far outside the viewport (px) to start rendering a page, so it's painted
 *  by the time the user scrolls to it. */
const PAGE_RENDER_ROOT_MARGIN_PX = 600;

interface PdfCanvasViewerProps {
  /** The PDF bytes to render. */
  blob: Blob;
  className?: string;
}

/**
 * Render a PDF to stacked, scrollable `<canvas>` pages via pdf.js.
 *
 * Pages are fit to the container width (responsive) and rendered lazily — a page
 * paints only when it scrolls near the viewport — so a long report (dozens of
 * pages) stays light. Replaces the blank-in-WKWebView `<iframe>` PDF view.
 */
export function PdfCanvasViewer({ blob, className }: PdfCanvasViewerProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState(false);
  const [width, setWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the document from the blob bytes. Destroy the loading task (which tears
  // down the worker + document) on change/unmount.
  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;
    setDoc(null);
    setError(false);
    blob
      .arrayBuffer()
      .then((buf) => {
        if (cancelled) return null;
        task = getDocument({ data: new Uint8Array(buf) });
        return task.promise;
      })
      .then((d: PDFDocumentProxy | null) => {
        if (cancelled || !d) return;
        setDoc(d);
      })
      .catch((e: unknown) => {
        logger.fromError('PDF_001:render', e instanceof Error ? e : new Error(String(e)));
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (task) void task.destroy();
    };
  }, [blob]);

  // Track the container width so pages render fit-to-width and re-fit on resize.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={cn('h-full w-full overflow-auto', className)}>
      {error ? (
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-sm text-destructive">Couldn’t render this PDF.</p>
        </div>
      ) : !doc || width === 0 ? (
        <div className="flex h-full w-full items-center justify-center">
          <Loader2 size={28} className="animate-spin text-muted" aria-hidden />
        </div>
      ) : (
        <div className="flex flex-col items-center py-2">
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} targetWidth={width} />
          ))}
        </div>
      )}
    </div>
  );
}

interface PdfPageProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  /** CSS width (px) to fit the page to. */
  targetWidth: number;
}

/** One lazily-rendered PDF page on its own canvas. */
function PdfPage({ doc, pageNumber, targetWidth }: PdfPageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [aspect, setAspect] = useState<number>(DEFAULT_PAGE_ASPECT_RATIO);
  const [rendered, setRendered] = useState(false);

  // Learn the true page aspect ratio so the placeholder reserves correct height.
  useEffect(() => {
    let cancelled = false;
    doc
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;
        const vp = page.getViewport({ scale: 1 });
        if (vp.width > 0) setAspect(vp.height / vp.width);
      })
      .catch(() => {
        /* keep default aspect; render effect will surface any real failure */
      });
    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber]);

  // Paint the page to canvas once it scrolls near the viewport.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || rendered || targetWidth === 0) return;

    const renderPage = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      // Backing-store scale = fit-to-width × device pixel ratio (crisp on HiDPI).
      const viewport = page.getViewport({ scale: (targetWidth / base.width) * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetWidth * (base.height / base.width)}px`;
      await page.render({ canvas, viewport }).promise;
      setRendered(true);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          io.disconnect();
          void renderPage().catch((e: unknown) => {
            logger.fromError(
              'PDF_002:page',
              e instanceof Error ? e : new Error(String(e)),
            );
          });
        }
      },
      { rootMargin: `${PAGE_RENDER_ROOT_MARGIN_PX}px` },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [doc, pageNumber, targetWidth, rendered]);

  return (
    <div
      ref={wrapRef}
      className="mb-3 bg-white shadow-sm"
      style={{ width: targetWidth, height: rendered ? undefined : targetWidth * aspect }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
