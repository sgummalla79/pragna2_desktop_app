/**
 * Port for the knowledge-library repository (RAG ladder Rung 2).
 *
 * Application layer depends on this interface; the axios-backed implementation
 * lives in `src/infrastructure/repositories/KnowledgeRepository.ts`. Covers the
 * top-level library CRUD and the nested document (source) sub-resource.
 */

import type {
  CreateLibraryPayload,
  IngestSourcePayload,
  KnowledgeLibrary,
  KnowledgeSource,
  UploadSourcePayload,
} from '@/domain/types/knowledge.types';

export interface IKnowledgeRepository {
  /** List the user's active libraries. Maps to `GET /api/knowledge-libraries`. */
  listLibraries(): Promise<KnowledgeLibrary[]>;

  /** Create a library (embedding model pinned from BE config). Maps to
   *  `POST /api/knowledge-libraries`. */
  createLibrary(payload: CreateLibraryPayload): Promise<KnowledgeLibrary>;

  /** Archive a library (frees the slug; cascades sources + chunks). Maps to
   *  `DELETE /api/knowledge-libraries/{id}` (204). */
  archiveLibrary(id: string): Promise<void>;

  /** List a library's documents (metadata only — never the text). Maps to
   *  `GET /api/knowledge-libraries/{id}/sources`. */
  listSources(libraryId: string): Promise<KnowledgeSource[]>;

  /** Ingest a document (pasted text OR an uploaded attachment). The BE stores
   *  the whole text (CAG) AND chunks+embeds it (RAG). Maps to
   *  `POST /api/knowledge-libraries/{id}/sources`. */
  ingestSource(
    libraryId: string,
    payload: IngestSourcePayload,
  ): Promise<KnowledgeSource>;

  /** Upload a document FILE (PDF / text / Markdown / CSV / docx / xlsx). The BE
   *  extracts its text in-process, then stores (CAG) + chunks/embeds (RAG).
   *  Maps to `POST /api/knowledge-libraries/{id}/sources/upload` (multipart). */
  uploadSource(
    libraryId: string,
    payload: UploadSourcePayload,
  ): Promise<KnowledgeSource>;

  /** Delete a document (cascades its chunks). Maps to
   *  `DELETE /api/knowledge-libraries/{id}/sources/{sourceId}` (204). */
  deleteSource(libraryId: string, sourceId: string): Promise<void>;
}
