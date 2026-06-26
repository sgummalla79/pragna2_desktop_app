import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EMPTY } from 'rxjs';
import type { Message } from '@ag-ui/client';
import type { RunAgentInput } from '@ag-ui/core';

// Capture the RequestInit the agent hands to the Tauri HTTP transport. Hoisted so
// the `vi.mock` factory (itself hoisted) can reference it safely.
const { runHttpRequestViaTauri } = vi.hoisted(() => ({ runHttpRequestViaTauri: vi.fn() }));
vi.mock('./tauriHttpRequest', () => ({ runHttpRequestViaTauri }));

import { TauriHttpAgent } from './TauriHttpAgent';

// Return an empty event stream so `run()` completes without real network I/O.
// Set after imports (EMPTY isn't available inside the hoisted factory); `mockClear`
// in beforeEach preserves this implementation.
runHttpRequestViaTauri.mockReturnValue(EMPTY);

/** Outgoing history with an orphaned PDF tool-call (no answering tool message). */
const orphanHistory = (): Message[] =>
  [
    { id: 'u1', role: 'user', content: 'Create a one-page PDF titled Q3 Status' },
    {
      id: 'a1',
      role: 'assistant',
      content: 'Here is your PDF.',
      toolCalls: [{ id: 'call_du4', type: 'function', function: { name: 'create_pdf', arguments: '{}' } }],
    },
  ] as unknown as Message[];

function inputFrom(messages: Message[]): RunAgentInput {
  return {
    threadId: 'thread-1',
    runId: 'run-1',
    tools: [],
    context: [],
    forwardedProps: {},
    state: {},
    messages,
  } as unknown as RunAgentInput;
}

function postedBody(): { messages: Array<{ id: string; role: string; toolCalls?: unknown[] }> } {
  const call = runHttpRequestViaTauri.mock.calls[0];
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe('TauriHttpAgent.run — sanitizes the outgoing tool-call history', () => {
  beforeEach(() => {
    runHttpRequestViaTauri.mockClear();
  });

  it('strips an orphaned assistant tool-call from the POSTed body', () => {
    const agent = new TauriHttpAgent({ url: 'http://localhost/api/chat', headers: {} });
    const input = inputFrom(orphanHistory());

    agent.run(input);

    const body = postedBody();
    const toolCallIds = body.messages.flatMap((m) =>
      ((m.toolCalls as { id: string }[] | undefined) ?? []).map((c) => c.id),
    );
    expect(toolCallIds).toEqual([]); // no dangling tool_call reaches the provider
    // the assistant prose row is still sent (only its orphaned tool_calls dropped)
    expect(body.messages.find((m) => m.id === 'a1')?.role).toBe('assistant');
  });

  it('leaves the agent in-memory messages (the rendered transcript) untouched', () => {
    const agent = new TauriHttpAgent({
      url: 'http://localhost/api/chat',
      headers: {},
      initialMessages: orphanHistory(),
    });

    agent.run(inputFrom(orphanHistory()));

    // The display list keeps the historical tool-call badge data.
    const a1 = agent.messages.find((m) => m.id === 'a1') as { toolCalls?: { id: string }[] };
    expect(a1.toolCalls?.map((c) => c.id)).toEqual(['call_du4']);
  });

  it('passes a fully-paired history through unchanged', () => {
    const paired = [
      { id: 'u1', role: 'user', content: 'pdf please' },
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call_1', type: 'function', function: { name: 'create_pdf', arguments: '{}' } }],
      },
      { id: 't1', role: 'tool', content: 'PDF created', toolCallId: 'call_1' },
      { id: 'a2', role: 'assistant', content: 'Done.' },
    ] as unknown as Message[];

    const agent = new TauriHttpAgent({ url: 'http://localhost/api/chat', headers: {} });
    agent.run(inputFrom(paired));

    const body = postedBody();
    const toolCallIds = body.messages.flatMap((m) =>
      ((m.toolCalls as { id: string }[] | undefined) ?? []).map((c) => c.id),
    );
    expect(toolCallIds).toEqual(['call_1']); // valid pair preserved
    expect(body.messages.map((m) => m.id)).toEqual(['u1', 'a1', 't1', 'a2']);
  });
});
