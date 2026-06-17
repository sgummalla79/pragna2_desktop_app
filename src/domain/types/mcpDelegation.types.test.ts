import { describe, expect, it } from 'vitest';

import {
  delegationResultFromOutcome,
  isDownstreamServiceReauth,
  MCP_DELEGATION_INTERRUPT_KIND,
  MCP_REAUTH_BOUNDARY_CONNECTOR,
  MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE,
  MCP_REAUTH_INTERRUPT_KIND,
  MCP_REAUTH_TRANSPORT_STDIO,
  readDelegationEnvelope,
  readReauthEnvelope,
  type ReauthEnvelope,
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

  it('parses the additive boundary-aware fields (#124)', () => {
    const env = readReauthEnvelope({
      [MCP_REAUTH_INTERRUPT_KIND]: {
        connector_id: 'conn-1',
        display_name: 'GUS (mcp-adaptor)',
        auth_type: 'none',
        reason: 'token_expired',
        boundary: MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE,
        transport: MCP_REAUTH_TRANSPORT_STDIO,
        service: 'gus',
        authorization_url: null,
        resume_actions: ['retry', 'continue'],
      },
    });
    expect(env?.boundary).toBe(MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE);
    expect(env?.transport).toBe(MCP_REAUTH_TRANSPORT_STDIO);
    expect(env?.service).toBe('gus');
    expect(env?.resume_actions).toEqual(['retry', 'continue']);
  });

  it('still parses an older 4-field envelope (back-compat)', () => {
    const env = readReauthEnvelope({
      [MCP_REAUTH_INTERRUPT_KIND]: {
        connector_id: 'conn-1',
        display_name: 'Gmail',
        auth_type: 'oauth',
        reason: 'revoked',
      },
    });
    expect(env).not.toBeNull();
    expect(env?.boundary).toBeUndefined();
  });
});

describe('delegationResultFromOutcome', () => {
  it('maps a normal result to tool_result', () => {
    expect(
      delegationResultFromOutcome({ kind: 'result', content: '{"ok":true}' }),
    ).toEqual({ tool_result: '{"ok":true}' });
  });

  it('maps an auth_required outcome to the structured variant (#124)', () => {
    expect(
      delegationResultFromOutcome({
        kind: 'auth_required',
        service: 'gus',
        reason: 'token_expired',
      }),
    ).toEqual({
      auth_required: { service: 'gus', reason: 'token_expired', authorization_url: null },
    });
  });

  it('carries a null service through (text-signal fallback case)', () => {
    expect(
      delegationResultFromOutcome({
        kind: 'auth_required',
        service: null,
        reason: 'token_expired',
      }),
    ).toEqual({
      auth_required: { service: null, reason: 'token_expired', authorization_url: null },
    });
  });
});

describe('isDownstreamServiceReauth', () => {
  const base: ReauthEnvelope = {
    connector_id: 'c1',
    display_name: 'GUS',
    auth_type: 'none',
    reason: 'token_expired',
  };

  it('is true only for boundary=downstream_service', () => {
    expect(
      isDownstreamServiceReauth({
        ...base,
        boundary: MCP_REAUTH_BOUNDARY_DOWNSTREAM_SERVICE,
      }),
    ).toBe(true);
  });

  it('is false for boundary=connector and for an absent boundary (older envelope)', () => {
    expect(
      isDownstreamServiceReauth({ ...base, boundary: MCP_REAUTH_BOUNDARY_CONNECTOR }),
    ).toBe(false);
    expect(isDownstreamServiceReauth(base)).toBe(false);
  });
});
