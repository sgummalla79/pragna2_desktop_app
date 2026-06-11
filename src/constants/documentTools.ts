/**
 * The backend's document-generation tools (`create_pdf_short` and
 * `create_pdf_long`).
 *
 * When the LLM calls either tool, the backend renders a PDF and attaches it to
 * the assistant message; the frontend surfaces it as a {@link DocumentCard}
 * (which opens the attachment viewer). The generic `ToolCallBadge` — which would
 * show the raw streamed JSON args and the "PDF … created" ack — is SUPPRESSED in
 * `ChatMessage` for both names, because the `DocumentCard` is the intended
 * representation. Mirrors `TOOL_CREATE_PDF_SHORT` / `TOOL_CREATE_PDF_LONG` in the
 * backend `src/constants.py` and the web app's `constants/documentTools.ts`.
 */

/** Single-shot builtin PDF tool (historical name `create_pdf`). */
export const CREATE_PDF_SHORT_TOOL_NAME = 'create_pdf_short';

/** Orchestrated multi-section PDF tool (generated in a background episode). */
export const CREATE_PDF_LONG_TOOL_NAME = 'create_pdf_long';

/** All document-generation tool names whose badge `ChatMessage` suppresses. */
export const DOCUMENT_TOOL_NAMES: ReadonlySet<string> = new Set([
  CREATE_PDF_SHORT_TOOL_NAME,
  CREATE_PDF_LONG_TOOL_NAME,
]);

/**
 * `seed_summary` the backend stamps on the background episode it spawns for a
 * `create_pdf_long` request. The chat surface detects an open episode carrying
 * this sentinel and (a) shows {@link LONG_PDF_GENERATING_LABEL} and (b) attaches
 * to the episode's live stream so the generated document posts back into the
 * transcript without a manual reload. Must match the backend value verbatim.
 */
export const LONG_PDF_EPISODE_SENTINEL = 'long_pdf';

/** Thinking-strip label shown while a `create_pdf_long` document is generating
 *  in its background episode (until the PDF turn posts back). */
export const LONG_PDF_GENERATING_LABEL = 'Generating your document...';
