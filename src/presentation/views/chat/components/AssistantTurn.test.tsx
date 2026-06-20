import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantTurn } from './AssistantTurn';
import { NO_REPLY_NOTICE } from '@/constants/chat';
import type {
  ChatMessage as ChatMessageModel,
  ChatToolCall,
} from '@/presentation/views/chat/hooks/useChatSession';

function msg(over: Partial<ChatMessageModel>): ChatMessageModel {
  return { id: 'x', role: 'assistant', content: '', ...over } as ChatMessageModel;
}
function tool(name: string, args?: Record<string, unknown>): ChatToolCall {
  return { id: name, name, argsBuffer: '', args, complete: true };
}

/** Stub that renders an "outside" message so we can assert what's in the transcript. */
const renderMessage = (m: ChatMessageModel, opts: { hideReasoning: boolean }) => (
  <div data-testid={`msg-${m.id}`} data-hide-reasoning={String(opts.hideReasoning)}>
    {m.content}
  </div>
);

const noAttachments = () => false;

describe('AssistantTurn', () => {
  it('folds interim narration + tool calls into one collapsed umbrella, answer stays outside', async () => {
    const messages = [
      msg({ id: 'a1', content: 'I will search the web', toolCalls: [tool('mcp_tavily_tavily_search', { query: 'AI trends' })] }),
      msg({ id: 'a2', content: 'Here is the final answer.' }),
    ];
    render(
      <AssistantTurn messages={messages} renderMessage={renderMessage} hasAttachment={noAttachments} streaming={false} />,
    );

    // Answer is in the transcript.
    expect(screen.getByTestId('msg-a2')).toHaveTextContent('Here is the final answer.');
    // Collapsed umbrella: summary is the friendly tool label; interim text hidden.
    expect(screen.getByText('Tavily Search')).toBeInTheDocument();
    expect(screen.queryByText('I will search the web')).toBeNull();
    expect(screen.queryByText('Done')).toBeNull();
    // No raw args/result JSON anywhere.
    expect(screen.queryByText(/query/)).toBeNull();

    // Expand → the activity steps appear (interim text + tool row + Done).
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByText('I will search the web')).toBeInTheDocument();
    expect(screen.getByText('AI trends')).toBeInTheDocument(); // primary arg, not raw JSON
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders no umbrella for a plain answer turn (no tools, no reasoning)', () => {
    render(
      <AssistantTurn messages={[msg({ id: 'a1', content: 'Just an answer.' })]} renderMessage={renderMessage} hasAttachment={noAttachments} streaming={false} />,
    );
    expect(screen.getByTestId('msg-a1')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull(); // no disclosure
  });

  it('folds reasoning into the umbrella and renders the answer with hideReasoning', () => {
    render(
      <AssistantTurn
        messages={[msg({ id: 'a1', content: 'The answer.', reasoning: 'my private thoughts' })]}
        renderMessage={renderMessage}
        hasAttachment={noAttachments}
        streaming={false}
      />,
    );
    // The answer message is rendered with hideReasoning=true.
    expect(screen.getByTestId('msg-a1')).toHaveAttribute('data-hide-reasoning', 'true');
    // Reasoning is in the umbrella (collapsed summary says "Reasoning").
    expect(screen.getByText('Reasoning')).toBeInTheDocument();
  });

  it('a completed tools-only turn shows the umbrella + the no-reply notice (no answer bubble)', () => {
    render(
      <AssistantTurn
        messages={[msg({ id: 'a1', content: 'searching', toolCalls: [tool('mcp_tavily_tavily_search')] })]}
        renderMessage={renderMessage}
        hasAttachment={noAttachments}
        streaming={false}
      />,
    );
    expect(screen.queryByTestId('msg-a1')).toBeNull();
    expect(screen.getByText('Tavily Search')).toBeInTheDocument();
    // #156: completed turn, no textual answer → subtle fallback notice, not a blank.
    expect(screen.getByText(NO_REPLY_NOTICE)).toBeInTheDocument();
  });

  it('#156: renders the no-reply notice when a completed turn ends with an empty final message after a tool call', () => {
    render(
      <AssistantTurn
        messages={[
          msg({ id: 'a1', content: '', toolCalls: [tool('orgcs_GetUserInfo')] }),
          msg({ id: 'a2', content: '' }), // empty final message from the LLM
        ]}
        renderMessage={renderMessage}
        hasAttachment={noAttachments}
        streaming={false}
      />,
    );
    expect(screen.getByText(NO_REPLY_NOTICE)).toBeInTheDocument();
    expect(screen.queryByTestId('msg-a2')).toBeNull(); // no answer bubble
  });

  it('#156: does NOT show the no-reply notice while the turn is still streaming', () => {
    render(
      <AssistantTurn
        messages={[msg({ id: 'a1', content: '', toolCalls: [tool('orgcs_GetUserInfo')] })]}
        renderMessage={renderMessage}
        hasAttachment={noAttachments}
        streaming
      />,
    );
    expect(screen.queryByText(NO_REPLY_NOTICE)).toBeNull();
  });

  it('#156: does NOT show the no-reply notice for a normal turn that has a textual answer', () => {
    render(
      <AssistantTurn
        messages={[
          msg({ id: 'a1', content: 'working', toolCalls: [tool('mcp_tavily_tavily_search')] }),
          msg({ id: 'a2', content: 'Here is the answer.' }),
        ]}
        renderMessage={renderMessage}
        hasAttachment={noAttachments}
        streaming={false}
      />,
    );
    expect(screen.queryByText(NO_REPLY_NOTICE)).toBeNull();
    expect(screen.getByTestId('msg-a2')).toBeInTheDocument();
  });

  it('keeps a generated-document message outside the umbrella (via hasAttachment)', () => {
    const messages = [
      msg({ id: 'a1', content: 'making a doc', toolCalls: [tool('create_pdf_short')] }),
    ];
    render(
      <AssistantTurn messages={messages} renderMessage={renderMessage} hasAttachment={(id) => id === 'a1'} streaming={false} />,
    );
    // The doc message renders outside (its DocumentCard would show via ChatMessage).
    expect(screen.getByTestId('msg-a1')).toBeInTheDocument();
  });

  it('streams open with a live "Working…" footer', () => {
    render(
      <AssistantTurn
        messages={[msg({ id: 'a1', content: 'thinking', toolCalls: [tool('mcp_tavily_tavily_search')] })]}
        renderMessage={renderMessage}
        hasAttachment={noAttachments}
        streaming
        progressLabel="Searching the web…"
      />,
    );
    expect(screen.getByText('Searching the web…')).toBeInTheDocument();
    expect(screen.getByText('Working…')).toBeInTheDocument();
  });
});
