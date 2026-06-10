import type {
  IEpisodeRepository,
  ListEpisodesOptions,
} from '@/application/ports/IEpisodeRepository';
import type {
  EpisodeListPage,
  EpisodeSnapshot,
} from '@/domain/types/episode.types';

/**
 * Application-layer facade over {@link IEpisodeRepository}. Thin delegations;
 * exists so views acquire the dependency through `useServices()` and future
 * cross-cutting concerns land here without changing call sites.
 */
export class EpisodeService {
  constructor(private readonly episodeRepository: IEpisodeRepository) {}

  list(
    conversationId: string,
    options?: ListEpisodesOptions,
  ): Promise<EpisodeListPage> {
    return this.episodeRepository.list(conversationId, options);
  }

  get(conversationId: string, episodeId: string): Promise<EpisodeSnapshot> {
    return this.episodeRepository.get(conversationId, episodeId);
  }
}
