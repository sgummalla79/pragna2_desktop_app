/**
 * Application service for knowledge libraries (RAG ladder Rung 2).
 *
 * Thin pass-through over `IKnowledgeRepository` covering the top-level library
 * CRUD and the nested document (source) sub-resource.
 */

import type { IKnowledgeRepository } from '@/application/ports/IKnowledgeRepository';
import type {
  AgentKnowledgeLibrary,
  AttachLibraryPayload,
  CreateLibraryPayload,
  IngestSourcePayload,
  KnowledgeLibrary,
  KnowledgeSource,
  UploadSourcePayload,
} from '@/domain/types/knowledge.types';

/** Manages knowledge libraries via the /api/knowledge-libraries endpoints. */
export class KnowledgeService {
  constructor(private readonly repo: IKnowledgeRepository) {}

  /** Returns the user's active knowledge libraries. */
  listLibraries(): Promise<KnowledgeLibrary[]> {
    return this.repo.listLibraries();
  }

  /** Creates a knowledge library (embedding model pinned from BE config). */
  createLibrary(payload: CreateLibraryPayload): Promise<KnowledgeLibrary> {
    return this.repo.createLibrary(payload);
  }

  /** Archives a library (frees the slug; cascades sources + chunks). */
  archiveLibrary(id: string): Promise<void> {
    return this.repo.archiveLibrary(id);
  }

  /** Lists one library's documents (metadata only). */
  listSources(libraryId: string): Promise<KnowledgeSource[]> {
    return this.repo.listSources(libraryId);
  }

  /** Ingests a document (pasted text OR an uploaded attachment). */
  ingestSource(
    libraryId: string,
    payload: IngestSourcePayload,
  ): Promise<KnowledgeSource> {
    return this.repo.ingestSource(libraryId, payload);
  }

  /** Uploads a document file; the BE extracts its text, then stores + embeds it. */
  uploadSource(
    libraryId: string,
    payload: UploadSourcePayload,
  ): Promise<KnowledgeSource> {
    return this.repo.uploadSource(libraryId, payload);
  }

  /** Deletes a document from a library (cascades its chunks). */
  deleteSource(libraryId: string, sourceId: string): Promise<void> {
    return this.repo.deleteSource(libraryId, sourceId);
  }

  /** Lists the libraries attached to an agent. */
  listAgentLibraries(agentId: string): Promise<AgentKnowledgeLibrary[]> {
    return this.repo.listAgentLibraries(agentId);
  }

  /** Attaches a library to an agent. */
  attachAgentLibrary(
    agentId: string,
    payload: AttachLibraryPayload,
  ): Promise<AgentKnowledgeLibrary> {
    return this.repo.attachAgentLibrary(agentId, payload);
  }

  /** Detaches a library binding from an agent. */
  detachAgentLibrary(agentId: string, bindingId: string): Promise<void> {
    return this.repo.detachAgentLibrary(agentId, bindingId);
  }
}
