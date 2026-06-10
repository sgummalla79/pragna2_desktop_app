import { describe, it, expect } from 'vitest';
import {
  mapKnowledgeLibrary,
  mapKnowledgeSource,
  mapAgentKnowledgeLibrary,
  toApiCreateLibraryPayload,
  toApiIngestSourcePayload,
  type ApiKnowledgeLibraryResponse,
  type ApiKnowledgeSourceResponse,
  type ApiAgentKnowledgeLibraryResponse,
} from './mapKnowledge';

describe('mapKnowledgeLibrary', () => {
  it('maps snake_case → camelCase', () => {
    const raw: ApiKnowledgeLibraryResponse = {
      id: 'l1',
      slug: 'kb',
      name: 'KB',
      description: null,
      embedding_model: 'text-embed',
      embedding_dimensions: 1536,
      status: 'ready',
      created_at: 'c',
      modified_at: 'm',
    };
    expect(mapKnowledgeLibrary(raw)).toEqual({
      id: 'l1',
      slug: 'kb',
      name: 'KB',
      description: null,
      embeddingModel: 'text-embed',
      embeddingDimensions: 1536,
      status: 'ready',
      createdAt: 'c',
      modifiedAt: 'm',
    });
  });
});

describe('mapKnowledgeSource', () => {
  it('maps snake_case → camelCase', () => {
    const raw: ApiKnowledgeSourceResponse = {
      id: 's1',
      library_id: 'l1',
      slug: 'doc',
      display_name: 'Doc',
      summary: null,
      token_count: 42,
      content_hash: 'abc',
      source_attachment_id: 'att1',
      status: 'ready',
      created_at: 'c',
      modified_at: 'm',
    };
    expect(mapKnowledgeSource(raw)).toMatchObject({
      id: 's1',
      libraryId: 'l1',
      displayName: 'Doc',
      tokenCount: 42,
      contentHash: 'abc',
      sourceAttachmentId: 'att1',
    });
  });
});

describe('mapAgentKnowledgeLibrary', () => {
  it('maps the binding', () => {
    const raw: ApiAgentKnowledgeLibraryResponse = {
      id: 'b1',
      agent_id: 'a1',
      library_id: 'l1',
      library_name: 'KB',
      library_slug: 'kb',
      created_at: 'c',
      modified_at: 'm',
    };
    expect(mapAgentKnowledgeLibrary(raw)).toMatchObject({
      agentId: 'a1',
      libraryId: 'l1',
      libraryName: 'KB',
      librarySlug: 'kb',
    });
  });
});

describe('toApiCreateLibraryPayload', () => {
  it('includes description only when set', () => {
    expect(toApiCreateLibraryPayload({ slug: 'kb', name: 'KB' })).toEqual({ slug: 'kb', name: 'KB' });
    expect(toApiCreateLibraryPayload({ slug: 'kb', name: 'KB', description: 'd' })).toEqual({
      slug: 'kb',
      name: 'KB',
      description: 'd',
    });
  });
});

describe('toApiIngestSourcePayload', () => {
  it('maps displayName→display_name and omits unset optionals', () => {
    expect(toApiIngestSourcePayload({ slug: 'doc', displayName: 'Doc' })).toEqual({
      slug: 'doc',
      display_name: 'Doc',
    });
  });

  it('includes text / attachment_id when provided', () => {
    expect(
      toApiIngestSourcePayload({ slug: 'doc', displayName: 'Doc', text: 'hi', attachmentId: 'a1' }),
    ).toEqual({ slug: 'doc', display_name: 'Doc', text: 'hi', attachment_id: 'a1' });
  });
});
