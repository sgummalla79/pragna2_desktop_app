import { describe, expect, it } from 'vitest';

import {
  MCP_DELEGATION_INTERRUPT_KIND,
  MCP_REAUTH_INTERRUPT_KIND,
  readDelegationEnvelope,
  readReauthEnvelope,
} from './mcpDelegation.types';

describe('readDelegationEnvelope', () => {
  it('parses a client-delegated tool pause envelope', () => {
    const interruptValue = {
      [MCP_DELEGATION_INTERRUPT_KIND]: {
        calls: [
          {
            connector_id: 'conn-1',
            tool_api_name: 'mcp.local.read',
            upstream_name: 'read',
            args: { path: '/x' },
            tool_call_id: 'tc-1',
          },
        ],
      },
    };
    const env = readDelegationEnvelope(interruptValue);
    expect(env).not.toBeNull();
    expect(env?.calls).toHaveLength(1);
    expect(env?.calls[0].upstream_name).toBe('read');
    expect(env?.calls[0].connector_id).toBe('conn-1');
  });

  it('returns null for an ask_user form pause', () => {
    expect(readDelegationEnvelope({ schema: { fields: [] } })).toBeNull();
  });

  it('returns null for null / non-object / malformed calls', () => {
    expect(readDelegationEnvelope(null)).toBeNull();
    expect(readDelegationEnvelope(undefined)).toBeNull();
    expect(readDelegationEnvelope('nope')).toBeNull();
    expect(
      readDelegationEnvelope({ [MCP_DELEGATION_INTERRUPT_KIND]: { calls: 'x' } }),
    ).toBeNull();
  });

  it('returns null for a connector re-auth pause', () => {
    expect(
      readDelegationEnvelope({
        [MCP_REAUTH_INTERRUPT_KIND]: { connector_id: 'c1' },
      }),
    ).toBeNull();
  });
});

describe('readReauthEnvelope', () => {
  it('parses a connector re-auth pause envelope', () => {
    const env = readReauthEnvelope({
      [MCP_REAUTH_INTERRUPT_KIND]: {
        connector_id: 'conn-1',
        display_name: 'Gmail',
        auth_type: 'oauth',
        reason: 'refresh_token_revoked',
      },
    });
    expect(env).not.toBeNull();
    expect(env?.connector_id).toBe('conn-1');
    expect(env?.display_name).toBe('Gmail');
  });

  it('returns null for a delegation / ask_user pause', () => {
    expect(
      readReauthEnvelope({ [MCP_DELEGATION_INTERRUPT_KIND]: { calls: [] } }),
    ).toBeNull();
    expect(readReauthEnvelope({ schema: { fields: [] } })).toBeNull();
  });

  it('returns null for null / non-object / missing connector_id', () => {
    expect(readReauthEnvelope(null)).toBeNull();
    expect(readReauthEnvelope('nope')).toBeNull();
    expect(readReauthEnvelope({ [MCP_REAUTH_INTERRUPT_KIND]: {} })).toBeNull();
  });
});
