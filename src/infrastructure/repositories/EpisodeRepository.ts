import type { AxiosInstance } from 'axios';
import type {
  IEpisodeRepository,
  ListEpisodesOptions,
} from '@/application/ports/IEpisodeRepository';
import type {
  EpisodeListPage,
  EpisodeSnapshot,
} from '@/domain/types/episode.types';
import {
  mapEpisode,
  mapEpisodeListPage,
  type ApiEpisodeListResponse,
  type ApiEpisodeResponse,
} from './mappers/mapEpisode';

/**
 * Axios-backed reader for HITL episodes (`/api/conversations/{id}/episodes*`).
 *
 * Reads only: the start/resume runs are SSE and stream through the chat
 * transport, not here. Call sites are resource-relative; the shared client
 * supplies the `/api` baseURL and the Tauri native HTTP adapter.
 */
export class EpisodeRepository implements IEpisodeRepository {
  constructor(private readonly http: AxiosInstance) {}

  async list(
    conversationId: string,
    options: ListEpisodesOptions = {},
  ): Promise<EpisodeListPage> {
    const { data } = await this.http.get<ApiEpisodeListResponse>(
      `/conversations/${conversationId}/episodes`,
      { params: { limit: options.limit, offset: options.offset } },
    );
    return mapEpisodeListPage(data);
  }

  async get(conversationId: string, episodeId: string): Promise<EpisodeSnapshot> {
    const { data } = await this.http.get<ApiEpisodeResponse>(
      `/conversations/${conversationId}/episodes/${episodeId}`,
    );
    return mapEpisode(data);
  }
}
