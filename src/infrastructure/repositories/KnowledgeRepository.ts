/**
 * Axios-backed implementation of `IKnowledgeRepository` (RAG ladder Rung 2).
 *
 * Maps domain payloads ↔ snake_case API shapes via `mappers/mapKnowledge.ts`.
 * Errors propagate as axios errors; the TanStack Query hook layer surfaces them.
 */

import type { AxiosInstance } from 'axios';
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
import {
  type ApiAgentKnowledgeLibraryResponse,
  type ApiKnowledgeLibraryResponse,
  type ApiKnowledgeSourceResponse,
  mapAgentKnowledgeLibrary,
  mapKnowledgeLibrary,
  mapKnowledgeSource,
  toApiCreateLibraryPayload,
  toApiIngestSourcePayload,
} from './mappers/mapKnowledge';

/** Manages knowledge libraries via the /api/knowledge-libraries endpoints. */
export class KnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly http: AxiosInstance) {}

  async listLibraries(): Promise<KnowledgeLibrary[]> {
    const { data } = await this.http.get<ApiKnowledgeLibraryResponse[]>(
      '/knowledge-libraries',
    );
    return data.map(mapKnowledgeLibrary);
  }

  async createLibrary(
    payload: CreateLibraryPayload,
  ): Promise<KnowledgeLibrary> {
    const { data } = await this.http.post<ApiKnowledgeLibraryResponse>(
      '/knowledge-libraries',
      toApiCreateLibraryPayload(payload),
    );
    return mapKnowledgeLibrary(data);
  }

  async archiveLibrary(id: string): Promise<void> {
    await this.http.delete(`/knowledge-libraries/${id}`);
  }

  async listSources(libraryId: string): Promise<KnowledgeSource[]> {
    const { data } = await this.http.get<ApiKnowledgeSourceResponse[]>(
      `/knowledge-libraries/${libraryId}/sources`,
    );
    return data.map(mapKnowledgeSource);
  }

  async ingestSource(
    libraryId: string,
    payload: IngestSourcePayload,
  ): Promise<KnowledgeSource> {
    const { data } = await this.http.post<ApiKnowledgeSourceResponse>(
      `/knowledge-libraries/${libraryId}/sources`,
      toApiIngestSourcePayload(payload),
    );
    return mapKnowledgeSource(data);
  }

  async uploadSource(
    libraryId: string,
    payload: UploadSourcePayload,
  ): Promise<KnowledgeSource> {
    const form = new FormData();
    form.append('slug', payload.slug);
    form.append('display_name', payload.displayName);
    if (payload.summary) form.append('summary', payload.summary);
    form.append('file', payload.file);
    // Pass the FormData straight through as the request body. The desktop's
    // native-HTTP axios adapter is hardened to strip the default JSON
    // Content-Type for FormData bodies, so the transport generates the
    // multipart boundary itself. Do NOT set Content-Type here.
    const { data } = await this.http.post<ApiKnowledgeSourceResponse>(
      `/knowledge-libraries/${libraryId}/sources/upload`,
      form,
    );
    return mapKnowledgeSource(data);
  }

  async deleteSource(libraryId: string, sourceId: string): Promise<void> {
    await this.http.delete(
      `/knowledge-libraries/${libraryId}/sources/${sourceId}`,
    );
  }

  // ── Agent attachments ──────────────────────────────────────────────────────

  async listAgentLibraries(agentId: string): Promise<AgentKnowledgeLibrary[]> {
    const { data } = await this.http.get<ApiAgentKnowledgeLibraryResponse[]>(
      `/agents/${agentId}/knowledge-libraries`,
    );
    return data.map(mapAgentKnowledgeLibrary);
  }

  async attachAgentLibrary(
    agentId: string,
    payload: AttachLibraryPayload,
  ): Promise<AgentKnowledgeLibrary> {
    const { data } = await this.http.post<ApiAgentKnowledgeLibraryResponse>(
      `/agents/${agentId}/knowledge-libraries`,
      { library_id: payload.libraryId },
    );
    return mapAgentKnowledgeLibrary(data);
  }

  async detachAgentLibrary(agentId: string, bindingId: string): Promise<void> {
    await this.http.delete(
      `/agents/${agentId}/knowledge-libraries/${bindingId}`,
    );
  }
}
