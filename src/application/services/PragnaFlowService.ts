import type { IPragnaFlowRepository } from '@/application/ports/IPragnaFlowRepository';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';

/**
 * Application-layer facade over {@link IPragnaFlowRepository}. One-line
 * delegation; exists so views acquire the dependency through `useServices()`
 * and future cross-cutting concerns land here without changing call sites.
 */
export class PragnaFlowService {
  constructor(private readonly pragnaFlowRepository: IPragnaFlowRepository) {}

  /** List the flows exposed as `/slash` commands for the chat composer. */
  listSlashFlows(): Promise<PragnaSlashFlow[]> {
    return this.pragnaFlowRepository.listSlashFlows();
  }
}
