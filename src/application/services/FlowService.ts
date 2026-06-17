import type {
  IFlowRepository,
  SaveFromYamlResult,
} from '@/application/ports/IFlowRepository';
import type {
  CreateFlowPayload,
  Flow,
  UpdateFlowPayload,
  UpdateFlowSlashExposurePayload,
} from '@/domain/types/flow.types';
import type { YamlValidationResult } from '@/domain/types/flowYaml.types';

/**
 * Application-layer facade over {@link IFlowRepository}. One-line delegations;
 * exists so views acquire the dependency through `useServices()` and future
 * cross-cutting concerns land here without changing call sites.
 */
export class FlowService {
  constructor(private readonly flowRepository: IFlowRepository) {}

  list(): Promise<Flow[]> {
    return this.flowRepository.list();
  }

  get(id: string): Promise<Flow> {
    return this.flowRepository.get(id);
  }

  create(payload: CreateFlowPayload): Promise<Flow> {
    return this.flowRepository.create(payload);
  }

  delete(id: string): Promise<void> {
    return this.flowRepository.delete(id);
  }

  validateYaml(definition: string): Promise<YamlValidationResult> {
    return this.flowRepository.validateYaml(definition);
  }

  saveFromYaml(definition: string): Promise<SaveFromYamlResult> {
    return this.flowRepository.saveFromYaml(definition);
  }

  saveFromYamlById(flowId: string, definition: string): Promise<SaveFromYamlResult> {
    return this.flowRepository.saveFromYamlById(flowId, definition);
  }

  updateFlow(flowId: string, payload: UpdateFlowPayload): Promise<Flow> {
    return this.flowRepository.updateFlow(flowId, payload);
  }

  updateSlashExposure(
    flowId: string,
    payload: UpdateFlowSlashExposurePayload,
  ): Promise<Flow> {
    return this.flowRepository.updateSlashExposure(flowId, payload);
  }
}
