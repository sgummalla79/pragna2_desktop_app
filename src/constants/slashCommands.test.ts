import { describe, it, expect } from 'vitest';
import { SLASH_COMMAND_RE, SLASH_MAX_ITEMS } from './slashCommands';

describe('SLASH_COMMAND_RE', () => {
  it('captures a bare name from a leading slash command', () => {
    expect('/research'.match(SLASH_COMMAND_RE)?.[1]).toBe('research');
    expect('/deep_research '.match(SLASH_COMMAND_RE)?.[1]).toBe('deep_research');
    expect('/flow-2 go'.match(SLASH_COMMAND_RE)?.[1]).toBe('flow-2');
  });

  it('requires whitespace or end-of-string as the terminator', () => {
    expect('/research now'.match(SLASH_COMMAND_RE)?.[1]).toBe('research');
    expect('/research'.match(SLASH_COMMAND_RE)?.[1]).toBe('research');
  });

  it('does not match mid-text slashes or invalid leading chars', () => {
    expect('hello /research'.match(SLASH_COMMAND_RE)).toBeNull();
    expect('/1bad'.match(SLASH_COMMAND_RE)).toBeNull(); // must start with letter or _
    expect('/'.match(SLASH_COMMAND_RE)).toBeNull();
    expect('/-x'.match(SLASH_COMMAND_RE)).toBeNull();
  });

  it('exposes a positive render cap', () => {
    expect(SLASH_MAX_ITEMS).toBeGreaterThan(0);
  });
});
