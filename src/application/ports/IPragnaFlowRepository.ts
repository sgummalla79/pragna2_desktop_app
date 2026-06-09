import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

/**
 * Port for the chat-surface flow discovery endpoint. Distinct from
 * {@link IFlowRepository} (the settings CRUD surface): this reads only the
 * slash-exposed projection the chat composer needs (`GET /api/pragna/flows`).
 */
export interface IPragnaFlowRepository {
  /** List the flows the user has exposed as `/slash` commands. */
  listSlashFlows(): Promise<PragnaSlashFlow[]>;
}
