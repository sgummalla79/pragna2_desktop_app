import { describe, it, expect } from 'vitest';
import { mapModel, type ApiModelResponse } from './mapModel';

const RAW: ApiModelResponse = {
  id: 'm1',
  user_provider_id: 'p1',
  api_name: 'claude-opus-4-8',
  display_name: 'Opus 4.8',
  cost_per_input_token: '0.000003',
  cost_per_output_token: '0.000015',
  enabled: true,
  available_for_chat: true,
  available_for_flows: false,
  archived: false,
  metadata: {},
  supports_vision: true,
  supports_pdf: true,
};

describe('mapModel', () => {
  it('maps api_name → modelName and costs as strings', () => {
    const out = mapModel(RAW);
    expect(out.modelName).toBe('claude-opus-4-8');
    expect(out.userProviderId).toBe('p1');
    expect(out.costPerInputToken).toBe('0.000003');
    expect(out.costPerOutputToken).toBe('0.000015');
    expect(out.availableForChat).toBe(true);
    expect(out.availableForFlows).toBe(false);
    expect(out.supportsVision).toBe(true);
    expect(out.supportsPdf).toBe(true);
  });

  it('defaults supports_vision/pdf and metadata for older responses', () => {
    const out = mapModel({
      ...RAW,
      supports_vision: undefined,
      supports_pdf: undefined,
      metadata: undefined as unknown as Record<string, unknown>,
    });
    expect(out.supportsVision).toBe(false);
    expect(out.supportsPdf).toBe(false);
    expect(out.metadata).toEqual({});
  });
});
