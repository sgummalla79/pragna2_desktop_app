import { describe, it, expect } from 'vitest';
import { validateAndFormatMcpConfig } from './validateMcpConfig';

// ── Helpers ────────────────────────────────────────────────────────────────

function ok(result: ReturnType<typeof validateAndFormatMcpConfig>) {
  if (!result.ok) throw new Error(`Expected ok but got error: ${result.error}`);
  return result.formatted;
}

function err(result: ReturnType<typeof validateAndFormatMcpConfig>) {
  if (result.ok) throw new Error('Expected error but got ok');
  return result.error;
}

// ── Valid inputs ───────────────────────────────────────────────────────────

describe('validateAndFormatMcpConfig — valid inputs', () => {
  it('formats a minimal valid config with command only', () => {
    const input = JSON.stringify({ mcpServers: { my_server: { command: '/bin/server' } } });
    const formatted = ok(validateAndFormatMcpConfig(input));
    const parsed = JSON.parse(formatted);
    expect(parsed.mcpServers.my_server.command).toBe('/bin/server');
    expect(parsed.mcpServers.my_server.args).toEqual([]);
    expect(parsed.mcpServers.my_server.env).toEqual({});
  });

  it('formats with 2-space indentation (pretty-printed)', () => {
    const input = '{"mcpServers":{"s":{"command":"x"}}}';
    const formatted = ok(validateAndFormatMcpConfig(input));
    expect(formatted).toContain('  "mcpServers"');
  });

  it('accepts args and env and normalises them through', () => {
    const input = JSON.stringify({
      mcpServers: {
        adaptor: {
          command: '/path/to/bin',
          args: ['serve', '--profile', 'me'],
          env: { TOKEN: 'abc' },
        },
      },
    });
    const formatted = ok(validateAndFormatMcpConfig(input));
    const parsed = JSON.parse(formatted);
    expect(parsed.mcpServers.adaptor.args).toEqual(['serve', '--profile', 'me']);
    expect(parsed.mcpServers.adaptor.env.TOKEN).toBe('abc');
  });

  it('accepts empty mcpServers object', () => {
    const formatted = ok(validateAndFormatMcpConfig('{"mcpServers":{}}'));
    expect(JSON.parse(formatted).mcpServers).toEqual({});
  });

  it('normalises blank/whitespace-only input to empty template', () => {
    const formatted = ok(validateAndFormatMcpConfig('   '));
    expect(JSON.parse(formatted).mcpServers).toEqual({});
  });

  it('normalises empty string to empty template', () => {
    const formatted = ok(validateAndFormatMcpConfig(''));
    expect(JSON.parse(formatted).mcpServers).toEqual({});
  });

  it('accepts a config with multiple servers', () => {
    const input = JSON.stringify({
      mcpServers: {
        a: { command: '/bin/a' },
        b: { command: '/bin/b', args: ['--flag'] },
      },
    });
    const formatted = ok(validateAndFormatMcpConfig(input));
    const parsed = JSON.parse(formatted);
    expect(Object.keys(parsed.mcpServers)).toHaveLength(2);
  });
});

// ── JSON syntax errors ─────────────────────────────────────────────────────

describe('validateAndFormatMcpConfig — JSON syntax errors', () => {
  it('reports a syntax error for truncated JSON', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":'));
    expect(error).toMatch(/JSON syntax error/i);
  });

  it('reports a syntax error for trailing comma', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{},}'));
    expect(error).toMatch(/JSON syntax error/i);
  });
});

// ── Structural errors ─────────────────────────────────────────────────────

describe('validateAndFormatMcpConfig — structural errors', () => {
  it('rejects a JSON array at root', () => {
    const error = err(validateAndFormatMcpConfig('[1, 2]'));
    expect(error).toMatch(/must be a JSON object/i);
  });

  it('rejects a JSON string at root', () => {
    const error = err(validateAndFormatMcpConfig('"hello"'));
    expect(error).toMatch(/must be a JSON object/i);
  });

  it('rejects missing mcpServers key', () => {
    const error = err(validateAndFormatMcpConfig('{"other":{}}'));
    expect(error).toMatch(/missing.*mcpServers/i);
  });

  it('rejects mcpServers as an array', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":[]}'));
    expect(error).toMatch(/mcpServers.*must be an object/i);
  });

  it('rejects mcpServers as a string', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":"bad"}'));
    expect(error).toMatch(/mcpServers.*must be an object/i);
  });

  it('rejects a server config that is not an object', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":"bad"}}'));
    expect(error).toMatch(/Server "s".*must be an object/i);
  });

  it('rejects a server with missing command', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":{"args":[]}}}'));
    expect(error).toMatch(/Server "s".*command.*non-empty string/i);
  });

  it('rejects a server with empty command string', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":{"command":""}}}'));
    expect(error).toMatch(/Server "s".*command.*non-empty string/i);
  });

  it('rejects args as a string instead of array', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":{"command":"x","args":"bad"}}}'));
    expect(error).toMatch(/Server "s".*args.*array of strings/i);
  });

  it('rejects args containing a number', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":{"command":"x","args":[1]}}}'));
    expect(error).toMatch(/Server "s".*args.*array of strings/i);
  });

  it('rejects env as an array', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":{"command":"x","env":[]}}}'));
    expect(error).toMatch(/Server "s".*env.*string.*string/i);
  });

  it('rejects env with a numeric value', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"s":{"command":"x","env":{"KEY":42}}}}'));
    expect(error).toMatch(/Server "s".*env\["KEY"\].*must be a string/i);
  });

  it('names the first failing server in the error message', () => {
    const error = err(validateAndFormatMcpConfig('{"mcpServers":{"alpha":{"command":"x"},"beta":{}}}'));
    expect(error).toMatch(/Server "beta"/);
  });
});
