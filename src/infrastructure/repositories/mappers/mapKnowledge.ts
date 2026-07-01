/**
 * Boundary mappers for knowledge libraries (snake_case API ↔ camelCase domain).
 */

import type {
  AgentKnowledgeLibrary,
  CreateLibraryPayload,
  IngestSourcePayload,
  KnowledgeLibrary,
  KnowledgeLibraryStatus,
  KnowledgeSource,
  KnowledgeSourceStatus,
} from '@/domain/types/knowledge.types';

/** Raw shape returned by the knowledge-library endpoints. */
export interface ApiKnowledgeLibraryResponse {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  embedding_model: string;
  embedding_dimensions: number;
  status: KnowledgeLibraryStatus;
  /** Optional: `true` for backend-seeded / system-managed libraries. Absent on
   *  older backends that predate the flag; treated as `false` when omitted. */
  is_system?: boolean;
  created_at: string;
  modified_at: string;
}

/** Raw shape returned by the library-source (document) endpoints. */
export interface ApiKnowledgeSourceResponse {
  id: string;
  library_id: string;
  slug: string;
  display_name: string;
  summary: string | null;
  token_count: number;
  content_hash: string;
  source_attachment_id: string | null;
  status: KnowledgeSourceStatus;
  created_at: string;
  modified_at: string;
}

/** Maps a raw API library response to the domain `KnowledgeLibrary`. */
export function mapKnowledgeLibrary(
  r: ApiKnowledgeLibraryResponse,
): KnowledgeLibrary {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    embeddingModel: r.embedding_model,
    embeddingDimensions: r.embedding_dimensions,
    status: r.status,
    isSystem: r.is_system ?? false,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
  };
}

/** Maps a raw API source response to the domain `KnowledgeSource`. */
export function mapKnowledgeSource(
  r: ApiKnowledgeSourceResponse,
): KnowledgeSource {
  return {
    id: r.id,
    libraryId: r.library_id,
    slug: r.slug,
    displayName: r.display_name,
    summary: r.summary,
    tokenCount: r.token_count,
    contentHash: r.content_hash,
    sourceAttachmentId: r.source_attachment_id,
    status: r.status,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
  };
}

/** Raw shape returned by `GET/POST /api/agents/{id}/knowledge-libraries`. */
export interface ApiAgentKnowledgeLibraryResponse {
  id: string;
  agent_id: string;
  library_id: string;
  library_name: string;
  library_slug: string;
  created_at: string;
  modified_at: string;
}

/** Maps a raw agent↔library binding response to the domain shape. */
export function mapAgentKnowledgeLibrary(
  r: ApiAgentKnowledgeLibraryResponse,
): AgentKnowledgeLibrary {
  return {
    id: r.id,
    agentId: r.agent_id,
    libraryId: r.library_id,
    libraryName: r.library_name,
    librarySlug: r.library_slug,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
  };
}

/** Serialises a `CreateLibraryPayload` to the snake_case API body. */
export function toApiCreateLibraryPayload(
  p: CreateLibraryPayload,
): Record<string, unknown> {
  return {
    slug: p.slug,
    name: p.name,
    ...(p.description !== undefined ? { description: p.description } : {}),
  };
}

/** Serialises an `IngestSourcePayload` to the snake_case API body. */
export function toApiIngestSourcePayload(
  p: IngestSourcePayload,
): Record<string, unknown> {
  return {
    slug: p.slug,
    display_name: p.displayName,
    ...(p.summary !== undefined ? { summary: p.summary } : {}),
    ...(p.text !== undefined ? { text: p.text } : {}),
    ...(p.attachmentId !== undefined ? { attachment_id: p.attachmentId } : {}),
  };
}
