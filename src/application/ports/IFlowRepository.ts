import type {
  CreateFlowPayload,
  Flow,
  UpdateFlowSlashExposurePayload,
} from '@/domain/types/flow.types';
import type { YamlValidationResult } from '@/domain/types/flowYaml.types';

/** Result of a save-from-YAML call, with whether it created a new row. */
export interface SaveFromYamlResult {
  flow: Flow;
  /** True when a new flow row was CREATED; false when an existing row was updated. */
  created: boolean;
}

/**
 * Port for flow persistence (`/api/flows/*`).
 *
 * Phase 1 surface: CRUD, slash-exposure toggle, and YAML authoring
 * (validate / from-yaml). Position persistence (`PATCH metadata.positions`) is
 * deferred to the Phase 2 interactive editor (see `docs/TODO.md` TD-020).
 */
export interface IFlowRepository {
  list(): Promise<Flow[]>;
  get(id: string): Promise<Flow>;
  create(payload: CreateFlowPayload): Promise<Flow>;
  delete(id: string): Promise<void>;

  /** Parse + cross-check a YAML flow document. Always succeeds at the HTTP
   *  layer — errors render inline. */
  validateYaml(definition: string): Promise<YamlValidationResult>;

  /** Persist a YAML-authored flow. Idempotent by `flow.api_name`
   *  (201 create / 200 update). */
  saveFromYaml(definition: string): Promise<SaveFromYamlResult>;

  /** Persist a YAML-authored flow by **id** (supports renaming `api_name` in
   *  place; 409 on collision with a different flow). */
  saveFromYamlById(flowId: string, definition: string): Promise<SaveFromYamlResult>;

  /** Toggle slash exposure + set / clear `slash_api_name`. 422 on validation
   *  failure, 409 on a per-user slash-name collision. */
  updateSlashExposure(
    flowId: string,
    payload: UpdateFlowSlashExposurePayload,
  ): Promise<Flow>;
}
