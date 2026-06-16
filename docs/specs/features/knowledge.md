# Feature Spec: Knowledge (Settings)

> **Status**: Implemented
> **Author**: Suman Gummalla
> **Created**: 2026-06-09
> **Last Updated**: 2026-06-09

---

## 1. Overview

The Knowledge settings page lets a user manage reusable document libraries (corpora) that agents and flows can later search via RAG. A user can create a knowledge library (a name, a portable reference id / slug, and an optional description — the embedding model is pinned by the backend at creation and is not client-selectable), see all of their active libraries, and archive a library they no longer need. Each library can be expanded to manage its documents (sources): a document can be added either by pasting raw text or by uploading a file (via the native file picker or drag-and-drop into the drop zone), and existing documents can be listed and deleted. This is RAG ladder Rung 2; the corpus stores both the full text (CAG) and chunked embeddings (RAG), but the page itself only ever shows document metadata, never the stored text.

## 2. Goals & Non-Goals

**Goals**
- [x] Create a knowledge library with a name, a reference id (slug), and an optional description.
- [x] List the user's active knowledge libraries.
- [x] Archive (soft-delete) a library, with a confirmation prompt; archiving frees the slug and cascades to its documents and chunks.
- [x] Per library: list its documents (metadata only — title, slug, approximate token count).
- [x] Add a document to a library by pasting text.
- [x] Add a document to a library by uploading a file (file picker or drag-and-drop), with slug + title pre-filled from the filename.
- [x] Delete a document from a library, with a confirmation prompt.
- [x] Surface backend `detail` error messages where present, falling back to the catalog message.

**Non-Goals**
- Selecting or changing a library's embedding model from the UI (the backend pins it at creation).
- Attaching/referencing a library from an agent or a flow (not ported here — see Out of Scope).
- Viewing or editing the stored document text after ingestion (the API never returns it).
- Editing an existing library's name/slug/description, or editing a document after creation.
- *(Implemented in pragna2-tracker TD-005 — no longer out of scope.)* Client-side file size/type
  pre-validation before upload; see Edge Cases.

## 3. User Stories

| As a... | I want to... | So that... |
|---------|-------------|------------|
| user | create a knowledge library with a name, reference id, and description | I have a named corpus to add documents to |
| user | see all my knowledge libraries with their pinned embedding model | I know what corpora exist and how they are embedded |
| user | archive a library I no longer need | it stops appearing and its slug is freed for reuse |
| user | paste document text into a library | I can add knowledge without having a file |
| user | upload a file (PDF / text / Markdown / CSV / docx / xlsx) into a library | I can add a document I already have on disk |
| user | drag-and-drop a file onto the upload area | I can add a document quickly without a file dialog |
| user | see the documents in a library and their token counts | I know what the corpus contains |
| user | delete a document from a library | I can remove content that no longer belongs |

## 4. Acceptance Criteria

- [x] Given the Knowledge page loads, when the libraries query is in flight, then a "Loading libraries…" message is shown (`aria-live="polite"`).
- [x] Given the libraries query fails, when the page renders, then `KNW_001`'s message ("Failed to load knowledge libraries.") is shown in an `role="alert"` region.
- [x] Given the user has no libraries, when the list resolves empty, then an empty state ("No knowledge libraries yet…") with a library icon is shown.
- [x] Given the create form, when both Name and Reference ID are non-empty, then the "Create library" button is enabled; otherwise it is disabled.
- [x] Given a successful create, when the mutation resolves, then the form closes and the libraries list is refreshed (query invalidation).
- [x] Given a create failure, when the mutation rejects, then the backend `detail` message is shown if present, otherwise `KNW_002` ("Failed to create the library.").
- [x] Given a library card, when its embedding model is shown, then it is rendered as a badge titled "Embedding model (pinned)".
- [x] Given the Delete action on a library, when the user confirms the prompt, then the library is archived and the list is refreshed; on failure, the backend `detail` message or `KNW_003` is shown.
- [x] Given a library card is expanded, when its documents query is in flight, then "Loading documents…" is shown; on error `KNW_004` ("Failed to load documents.") is shown; when empty, "No documents yet. Add one below." is shown.
- [x] Given the add-document form in "Paste text" mode, when Reference ID, Title, and non-empty text are present, then "Add document" is enabled.
- [x] Given the add-document form in "Upload file" mode, when Reference ID, Title, and a chosen file are present, then "Add document" is enabled.
- [x] Given a file is chosen or dropped, when its name is read, then the slug (kebab-cased via `slugify`) and the title are pre-filled from the filename base if those fields are still empty (the user can still edit them).
- [x] Given a successful add (text or file), when the mutation resolves, then the add form resets and that library's documents list is refreshed.
- [x] Given an add/upload failure, when the mutation rejects, then the backend `detail` is shown if present, otherwise `KNW_005` (paste-text) or `KNW_006` (file upload).
- [x] Given the Delete action on a document, when the user confirms, then the document is deleted and the documents list is refreshed; on failure the backend `detail` or `KNW_007` is shown.
- [x] Given the upload control, when the user opens the native file picker, then it is filtered to `.pdf,.txt,.md,.markdown,.csv,.docx,.xlsx` and the hint text reads "PDF, text, Markdown, CSV, docx, xlsx".

## 5. Edge Cases & Error Scenarios

| Scenario | Expected Behavior |
|----------|------------------|
| Libraries list empty | Empty state with library icon and guidance text. |
| Libraries query fails | `KNW_001` message in an alert region. |
| Library expanded, documents list empty | "No documents yet. Add one below." dashed-border placeholder. |
| Documents query fails | `KNW_004` message in an alert region. |
| Create with blank Name or Reference ID | Submit button disabled; no request made. |
| Create rejected by backend (e.g. duplicate slug) | Backend `detail` surfaced if present, else `KNW_002`. |
| Archive library rejected | Backend `detail` if present, else `KNW_003`; error shown on the card. |
| Add (paste text) rejected | Backend `detail` if present, else `KNW_005`. |
| Add (file upload) rejected | Backend `detail` if present, else `KNW_006`. |
| Delete document rejected | Backend `detail` if present, else `KNW_007`. |
| Unsupported file type chosen | Rejected client-side before upload by `validateKnowledgeFile` (extension vs the accept list) on **both** the picker and drag-drop paths, with an inline message (pragna2-tracker TD-005). The backend stays the real gate (415 via `detail` / `KNW_006`). |
| Oversized file uploaded | Rejected client-side when over `KNOWLEDGE_MAX_FILE_BYTES` (25 MB) with an inline message, before the round-trip (pragna2-tracker TD-005). The backend remains the real cap (413). |
| Multipart upload not yet verified live | The FormData/multipart upload path through the native-HTTP adapter has not been exercised end-to-end against the running backend from the dev environment. See pragna2-tracker TD-004. |
| Slug/title left as filename default | Accepted as-is; pre-fill only fills empty fields and is user-editable. |

## 6. Out of Scope

- **Attaching a library to an agent or a flow.** The reference-from-agent/flow surface is not ported in this feature; the page only manages library and document lifecycle.
- **Embedding-model selection.** The model is pinned by the backend at creation and shown read-only.
- **Reading/editing stored document text.** The sources API returns metadata only.
- **Editing existing libraries or documents.** Only create / list / archive (library) and add / list / delete (document) are implemented.

## 7. Open Questions

- [ ] pragna2-tracker TD-004 — Verify the multipart Knowledge upload end-to-end against the live backend (a real pdf/txt/md/csv/docx/xlsx upload succeeds on a packaged macOS build and the source appears in the library).
- [x] pragna2-tracker TD-005 — *(Done 2026-06-09.)* Client-side size/type validation
  (`validateKnowledgeFile`, picker + drag-drop) rejects oversized/unsupported
  files before upload. The 25 MB cap (`KNOWLEDGE_MAX_FILE_BYTES`) is a named
  constant with a comment (the API exposes no limit; backend stays the real gate).

---

_Link to Technical Spec: [technical/knowledge.md](../technical/knowledge.md)_
