/**
 * Domain types for knowledge libraries (RAG ladder Rung 2).
 *
 * Frontend shapes for `/api/knowledge-libraries/*`. The backend serialises in
 * snake_case; mappers in `infrastructure/repositories/mappers/mapKnowledge.ts`
 * translate at the boundary. UI code only sees the camelCase shapes here.
 */

/** Lifecycle status — mirrors the BE `knowledge_libraries.status` column.
 *  `active` = usable; `archived` = soft-deleted (frees the slug). */
export type KnowledgeLibraryStatus = 'active' | 'archived';

/** Lifecycle status of one document inside a library. */
export type KnowledgeSourceStatus = 'pending' | 'ready' | 'failed';

/** One row from `GET /api/knowledge-libraries`. A corpus the user owns; the
 *  embedding model is pinned at creation and immutable once it has chunks. */
export interface KnowledgeLibrary {
  /** UUID of the knowledge_libraries record. */
  id: string;
  /** Portable kebab handle, unique per active library. */
  slug: string;
  /** User-facing title. */
  name: string;
  /** Optional prose describing the corpus. */
  description: string | null;
  /** The embedding model the corpus's vectors were produced with (pinned). */
  embeddingModel: string;
  /** The vector dimension for this library's chunks. */
  embeddingDimensions: number;
  /** Lifecycle status. */
  status: KnowledgeLibraryStatus;
  /** ISO-8601 timestamps from the BE. */
  createdAt: string;
  modifiedAt: string;
}

/** One document inside a library (`/api/knowledge-libraries/{id}/sources`).
 *  The full extracted text is NEVER returned — only metadata. */
export interface KnowledgeSource {
  id: string;
  libraryId: string;
  /** Portable kebab handle, unique per library. */
  slug: string;
  displayName: string;
  summary: string | null;
  /** Approximate token count of the extracted text. */
  tokenCount: number;
  contentHash: string;
  /** The uploaded attachment the text was extracted from, when from a file. */
  sourceAttachmentId: string | null;
  status: KnowledgeSourceStatus;
  createdAt: string;
  modifiedAt: string;
}

/** Body for `POST /api/knowledge-libraries`. The embedding model is pinned
 *  from BE config, not client-supplied. */
export interface CreateLibraryPayload {
  slug: string;
  name: string;
  description?: string;
}

/** Body for `POST /api/knowledge-libraries/{id}/sources`. Supply exactly ONE
 *  of `text` / `attachmentId` as the document body. */
export interface IngestSourcePayload {
  slug: string;
  displayName: string;
  summary?: string;
  text?: string;
  attachmentId?: string;
}

/** Body for `POST /api/knowledge-libraries/{id}/sources/upload` (multipart).
 *  The BE extracts the file's text in-process, then stores it (CAG) +
 *  chunks/embeds it (RAG) — only the text is kept, not the original file. */
export interface UploadSourcePayload {
  slug: string;
  displayName: string;
  summary?: string;
  file: File;
}

/** One agent↔library attachment row (binding + library details), returned by
 *  `GET /api/agents/{id}/knowledge-libraries`. `id` is the binding id (used to
 *  detach). Consumed by the Agents feature's knowledge section. */
export interface AgentKnowledgeLibrary {
  id: string;
  agentId: string;
  libraryId: string;
  libraryName: string;
  librarySlug: string;
  createdAt: string;
  modifiedAt: string;
}

/** Body for `POST /api/agents/{id}/knowledge-libraries`. */
export interface AttachLibraryPayload {
  libraryId: string;
}
