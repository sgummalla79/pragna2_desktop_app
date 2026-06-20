import { describe, it, expect } from 'vitest';
import {
  groupChatMessages,
  answerMessageId,
  isOutputToolName,
  isPlainToolCall,
} from './assistantTurns';
import type {
  ChatMessage as ChatMessageModel,
  ChatToolCall,
} from '../hooks/useChatSession';

function msg(over: Partial<ChatMessageModel>): ChatMessageModel {
  return { id: 'x', role: 'assistant', content: '', ...over } as ChatMessageModel;
}
function tool(name: string): ChatToolCall {
  return { id: name, name, argsBuffer: '', complete: true };
}

describe('groupChatMessages', () => {
  it('groups a user message then a run of assistant messages into one turn', () => {
    const groups = groupChatMessages([
      msg({ id: 'u1', role: 'user', content: 'hi' }),
      msg({ id: 'a1', content: 'I will search', toolCalls: [tool('web_search')] }),
      msg({ id: 'a2', content: 'the answer' }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ kind: 'message', message: expect.objectContaining({ id: 'u1' }) });
    expect(groups[1].kind).toBe('assistant-turn');
    expect((groups[1] as { messages: ChatMessageModel[] }).messages.map((m) => m.id)).toEqual(['a1', 'a2']);
  });

  it('drops tool-role messages but keeps the surrounding assistant turn intact', () => {
    const groups = groupChatMessages([
      msg({ id: 'a1', content: 'searching', toolCalls: [tool('web_search')] }),
      msg({ id: 'tr1', role: 'tool', content: '{"raw":"result"}' }),
      msg({ id: 'a2', content: 'answer' }),
    ]);
    expect(groups).toHaveLength(1);
    expect((groups[0] as { messages: ChatMessageModel[] }).messages.map((m) => m.id)).toEqual(['a1', 'a2']);
  });

  it('separates turns across user messages', () => {
    const groups = groupChatMessages([
      msg({ id: 'u1', role: 'user', content: 'q1' }),
      msg({ id: 'a1', content: 'a1' }),
      msg({ id: 'u2', role: 'user', content: 'q2' }),
      msg({ id: 'a2', content: 'a2' }),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(['message', 'assistant-turn', 'message', 'assistant-turn']);
  });

  // tracker #148: when a completed assistant turn ends up ADJACENT to a later
  // one with no user message between (a re-attached streaming run after a
  // remount), `endsTurn` splits them so the prior turn isn't folded into the
  // live umbrella.
  it('splits adjacent assistant turns at an endsTurn boundary (no user between)', () => {
    const completed = new Set(['a1']); // a1 carries a persisted terminal stop
    const groups = groupChatMessages(
      [
        msg({ id: 'a1', content: 'prior completed answer' }),
        msg({ id: 'a2', content: 'resuming stream…' }),
      ],
      (m) => completed.has(m.id),
    );
    expect(groups.map((g) => g.kind)).toEqual(['assistant-turn', 'assistant-turn']);
    expect((groups[0] as { messages: ChatMessageModel[] }).messages.map((m) => m.id)).toEqual(['a1']);
    expect((groups[1] as { messages: ChatMessageModel[] }).messages.map((m) => m.id)).toEqual(['a2']);
  });

  it('does NOT split a single turn at a non-terminal (tool_calls / mid-turn) message', () => {
    // endsTurn fires for none here (mimics tool_calls / null → not terminal):
    // the tool-call message and its follow-up answer stay in ONE turn.
    const groups = groupChatMessages(
      [
        msg({ id: 'a1', content: 'searching', toolCalls: [tool('web_search')] }),
        msg({ id: 'a2', content: 'final answer' }),
      ],
      () => false,
    );
    expect(groups).toHaveLength(1);
    expect((groups[0] as { messages: ChatMessageModel[] }).messages.map((m) => m.id)).toEqual(['a1', 'a2']);
  });
});

describe('answerMessageId', () => {
  it('returns the last message when it has text and no tools', () => {
    expect(
      answerMessageId([
        msg({ id: 'a1', content: 'thinking', toolCalls: [tool('web_search')] }),
        msg({ id: 'a2', content: 'final answer' }),
      ]),
    ).toBe('a2');
  });

  it('returns null when the turn ends on a tool call (still working)', () => {
    expect(
      answerMessageId([msg({ id: 'a1', content: 'searching', toolCalls: [tool('web_search')] })]),
    ).toBeNull();
  });

  it('returns null when the last message has no text', () => {
    expect(answerMessageId([msg({ id: 'a1', content: '   ' })])).toBeNull();
  });

  it('#156: returns null when the turn ends with an empty-content message after a tool call', () => {
    // Pins the behaviour that makes AssistantTurn fall back to the no-reply
    // notice — the BE sent an empty final message (#155), so there is no answer
    // id and the renderer must not leave the body blank.
    expect(
      answerMessageId([
        msg({ id: 'a1', content: '', toolCalls: [tool('orgcs_GetUserInfo')] }),
        msg({ id: 'a2', content: '' }),
      ]),
    ).toBeNull();
  });
});

describe('isOutputToolName / isPlainToolCall', () => {
  it('treats document + propose-flow tools as outputs', () => {
    expect(isOutputToolName('create_pdf_short')).toBe(true);
    expect(isOutputToolName('create_pdf_long')).toBe(true);
    expect(isOutputToolName('propose_flow_research')).toBe(true);
  });

  it('treats a normal MCP/search tool as a plain (umbrella) tool', () => {
    expect(isOutputToolName('mcp_tavily_tavily_search')).toBe(false);
    expect(isPlainToolCall(tool('mcp_tavily_tavily_search'))).toBe(true);
    expect(isPlainToolCall(tool('create_pdf_short'))).toBe(false);
  });
});
