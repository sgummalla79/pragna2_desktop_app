import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import type { Attachment } from '@/domain/types/attachment.types';
import type { ChatMessage as ChatMessageModel } from '@/presentation/views/chat/hooks/useChatSession';
import { ChatMessage } from './ChatMessage';

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ServiceContext.Provider
        value={
          {
            modelService: { list: vi.fn().mockResolvedValue([]) },
            attachmentService: { fetchContent: vi.fn() },
          } as unknown as Services
        }
      >
        {children}
      </ServiceContext.Provider>
    </QueryClientProvider>
  );
}

const PDF: Attachment = {
  id: 'doc1',
  filename: 'Report.pdf',
  contentType: 'application/pdf',
  sizeBytes: 10,
  expired: false,
};

const assistant = (over: Partial<ChatMessageModel> = {}): ChatMessageModel =>
  ({ id: 'm1', role: 'assistant', content: 'Here is your document.', ...over }) as ChatMessageModel;

describe('ChatMessage — generated documents', () => {
  it('renders an assistant attachment as a DocumentCard', () => {
    render(<ChatMessage message={assistant()} attachments={[PDF]} onOpenAttachment={vi.fn()} />, {
      wrapper: wrap(),
    });
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('suppresses the create_pdf_short tool-call badge (the DocumentCard represents it)', () => {
    const msg = assistant({
      toolCalls: [{ id: 't1', name: 'create_pdf_short', argsBuffer: '{}', args: {} }],
    });
    render(<ChatMessage message={msg} attachments={[PDF]} onOpenAttachment={vi.fn()} />, {
      wrapper: wrap(),
    });
    expect(screen.queryByText('create_pdf_short')).not.toBeInTheDocument();
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  it('still shows a normal tool-call badge for non-document tools, with a friendly label (not the raw name)', () => {
    const msg = assistant({
      toolCalls: [{ id: 't2', name: 'web_search', argsBuffer: '{}', args: {} }],
    });
    render(<ChatMessage message={msg} />, { wrapper: wrap() });
    expect(screen.getByTestId('tool-call-badge')).toBeInTheDocument();
    expect(screen.getByText('Web Search')).toBeInTheDocument();
    expect(screen.queryByText('web_search')).not.toBeInTheDocument();
  });

  it('does NOT offer Regenerate on a tool-call row (regenerating mid-turn re-runs from a dangling tool call)', () => {
    const msg = assistant({
      content: '',
      toolCalls: [{ id: 't1', name: 'create_pdf_short', argsBuffer: '{}', args: {} }],
    });
    render(
      <ChatMessage message={msg} attachments={[PDF]} onOpenAttachment={vi.fn()} actions={{ onRegenerate: vi.fn() }} />,
      { wrapper: wrap() },
    );
    expect(screen.queryByRole('button', { name: /Regenerate/i })).toBeNull();
    // The DocumentCard still renders — only the regenerate affordance is gone.
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  it('DOES offer Regenerate on the final text answer (no tool calls)', () => {
    render(
      <ChatMessage message={assistant({ content: 'The final answer.' })} actions={{ onRegenerate: vi.fn() }} />,
      { wrapper: wrap() },
    );
    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
  });

  it('suppresses a tool-role message — never dumps its raw result payload', () => {
    const rawResult =
      '{"query":"AI trends","results":[{"url":"https://example.com","score":0.9}],"request_id":"abc"}';
    const toolMsg = {
      id: 'tr1',
      role: 'tool',
      content: rawResult,
    } as ChatMessageModel;
    const { container } = render(<ChatMessage message={toolMsg} />, { wrapper: wrap() });
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText(/request_id/)).toBeNull();
    expect(screen.queryByText(/example\.com/)).toBeNull();
  });
});
