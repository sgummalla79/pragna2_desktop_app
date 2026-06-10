import { describe, it, expect } from 'vitest';
import {
  mapEpisode,
  mapEpisodeListPage,
  type ApiEpisodeResponse,
  type ApiEpisodeListResponse,
} from './mapEpisode';

const RAW: ApiEpisodeResponse = {
  id: 'e1',
  conversation_id: 'c1',
  flow_id: 'f1',
  thread_id: 't1',
  status: 'awaiting_user',
  seed_summary: 'sum',
  seed_user_input: 'in',
  interrupt_value: { schema: { fields: [] } },
  created_at: '2026-01-01T00:00:00Z',
  modified_at: '2026-01-02T00:00:00Z',
  ended_at: null,
};

describe('mapEpisode', () => {
  it('maps snake_case → camelCase, preserving nulls + interrupt value', () => {
    expect(mapEpisode(RAW)).toEqual({
      id: 'e1',
      conversationId: 'c1',
      flowId: 'f1',
      threadId: 't1',
      status: 'awaiting_user',
      seedSummary: 'sum',
      seedUserInput: 'in',
      interruptValue: { schema: { fields: [] } },
      createdAt: '2026-01-01T00:00:00Z',
      modifiedAt: '2026-01-02T00:00:00Z',
      endedAt: null,
    });
  });
});

describe('mapEpisodeListPage', () => {
  it('maps the envelope + each episode', () => {
    const raw: ApiEpisodeListResponse = { episodes: [RAW], limit: 1, offset: 0 };
    const out = mapEpisodeListPage(raw);
    expect(out.limit).toBe(1);
    expect(out.offset).toBe(0);
    expect(out.episodes).toHaveLength(1);
    expect(out.episodes[0].id).toBe('e1');
  });

  it('defaults episodes to [] when absent', () => {
    const out = mapEpisodeListPage({ limit: 5, offset: 0 } as unknown as ApiEpisodeListResponse);
    expect(out.episodes).toEqual([]);
  });
});
