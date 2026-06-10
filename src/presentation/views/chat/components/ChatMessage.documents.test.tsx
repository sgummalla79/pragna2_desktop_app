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

  it('still shows a normal tool-call badge for non-document tools', () => {
    const msg = assistant({
      toolCalls: [{ id: 't2', name: 'web_search', argsBuffer: '{}', args: {} }],
    });
    render(<ChatMessage message={msg} />, { wrapper: wrap() });
    expect(screen.getByText('web_search')).toBeInTheDocument();
  });
});
