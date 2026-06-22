/**
 * Single configuration point for pdf.js (`pdfjs-dist`).
 *
 * pdf.js renders PDF pages to a `<canvas>`. We use it instead of an
 * `<iframe src="blob:…">` because macOS WKWebView (Tauri's webview) does NOT
 * render a PDF from a blob URL inside an iframe — it shows a blank frame.
 * Canvas rendering paints the same bytes and works in every webview (WKWebView,
 * WebView2) and in the plain-browser fallback.
 *
 * The worker is bundled via Vite's `?url` import (no network / CDN), so the
 * viewer works fully offline. `GlobalWorkerOptions.workerSrc` MUST be assigned in
 * the module that the viewer imports `getDocument` from, so this side effect runs
 * before the first `getDocument()` call (importing `getDocument` from here
 * guarantees that order).
 */
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export { getDocument };
export type {
  PDFDocumentProxy,
  PDFDocumentLoadingTask,
  PDFPageProxy,
} from 'pdfjs-dist';
