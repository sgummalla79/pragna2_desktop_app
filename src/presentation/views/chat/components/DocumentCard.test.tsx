import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceContext, type Services } from '@/presentation/providers/ServiceContext';
import type { Attachment } from '@/domain/types/attachment.types';
import { DocumentCard } from './DocumentCard';

const PDF: Attachment = {
  id: 'a1',
  filename: 'Platform Architecture.pdf',
  contentType: 'application/pdf',
  sizeBytes: 1234,
  expired: false,
};

function wrap(fetchContent = vi.fn().mockResolvedValue(new Blob(['x']))) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceContext.Provider value={{ attachmentService: { fetchContent } } as unknown as Services}>
      {children}
    </ServiceContext.Provider>
  );
  return { Wrapper, fetchContent };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:doc');
  URL.revokeObjectURL = vi.fn();
});

describe('DocumentCard', () => {
  it('renders the title without the .pdf extension and a "Document · PDF" label', () => {
    const { Wrapper } = wrap();
    render(<DocumentCard attachment={PDF} />, { wrapper: Wrapper });
    expect(screen.getByText('Platform Architecture')).toBeInTheDocument();
    expect(screen.getByText('Document · PDF')).toBeInTheDocument();
  });

  it('opens via onOpen when the title region is clicked', async () => {
    const onOpen = vi.fn();
    const { Wrapper } = wrap();
    render(<DocumentCard attachment={PDF} onOpen={onOpen} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByTestId('document-card'));
    expect(onOpen).toHaveBeenCalledWith(PDF);
  });

  it('downloads the bytes via fetchContent on Download', async () => {
    const { Wrapper, fetchContent } = wrap();
    render(<DocumentCard attachment={PDF} />, { wrapper: Wrapper });

    await userEvent.click(screen.getByRole('button', { name: /download platform architecture/i }));
    await waitFor(() => expect(fetchContent).toHaveBeenCalledWith('a1'));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('disables open + download and prefixes [expired] when expired', () => {
    const { Wrapper } = wrap();
    render(<DocumentCard attachment={{ ...PDF, expired: true }} onOpen={vi.fn()} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByText('[expired] Platform Architecture')).toBeInTheDocument();
    expect(screen.getByTestId('document-card')).toBeDisabled();
    expect(screen.getByRole('button', { name: /download/i })).toBeDisabled();
  });

  it('labels a non-PDF document as "Document · Document"', () => {
    const { Wrapper } = wrap();
    render(
      <DocumentCard attachment={{ ...PDF, filename: 'notes.txt', contentType: 'text/plain' }} />,
      { wrapper: Wrapper },
    );
    expect(screen.getByText('Document · Document')).toBeInTheDocument();
  });
});
