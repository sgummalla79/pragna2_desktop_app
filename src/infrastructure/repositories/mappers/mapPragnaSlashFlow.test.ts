import { describe, it, expect } from 'vitest';
import { mapPragnaSlashFlow, type ApiPragnaSlashFlowResponse } from './mapPragnaSlashFlow';

describe('mapPragnaSlashFlow', () => {
  it('maps snake_case → camelCase', () => {
    const raw: ApiPragnaSlashFlowResponse = {
      slash_api_name: 'research',
      display_name: 'Research',
      description: 'Run research',
    };
    expect(mapPragnaSlashFlow(raw)).toEqual({
      slashApiName: 'research',
      displayName: 'Research',
      description: 'Run research',
    });
  });

  it('defaults description to empty string when absent', () => {
    const out = mapPragnaSlashFlow({
      slash_api_name: 'r',
      display_name: 'R',
    } as unknown as ApiPragnaSlashFlowResponse);
    expect(out.description).toBe('');
  });
});
