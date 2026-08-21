import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import type { Attachment } from '@/domain/types/attachment.types';
import type { PragnaSlashFlow } from '@/domain/types/pragnaSlashFlow.types';
import { ChatInput } from './ChatInput';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
import { toast } from 'sonner';

/**
 * ChatInput: send/stop gating, Enter-vs-Shift+Enter, the attach button + chip,
 * and the `/slash` popover. Attachments go through `useUploadAttachment` →
 * `attachmentService.upload`, mocked here. Object-URL machinery is stubbed.
 */

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:chip');
  URL.revokeObjectURL = vi.fn();
});

const uploadedAttachment: Attachment = {
  id: 'att-1',
  conversationId: 'c1',
  messageId: null,
  filename: 'shot.png',
  contentType: 'image/png',
  sizeBytes: 5,
  uploadedAt: '2026-01-01T00:00:00Z',
  expired: false,
};

function servicesWithUpload(upload = vi.fn().mockResolvedValue(uploadedAttachment)) {
  return { services: { attachmentService: { upload } } as never, upload };
}

/** Controlled host so typing updates `value` like the real parents do. */
function Host(props: {
  onSubmit?: (ids: string[]) => void;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  slashFlows?: PragnaSlashFlow[];
  conversationId?: string;
  initial?: string;
}) {
  const [value, setValue] = useState(props.initial ?? '');
  return (
    <ChatInput
      value={value}
      onChange={setValue}
      onSubmit={props.onSubmit ?? vi.fn()}
      onStop={props.onStop}
      running={props.running}
      disabled={props.disabled}
      slashFlows={props.slashFlows}
      conversationId={props.conversationId}
    />
  );
}

describe('ChatInput — send gating', () => {
  it('keeps Send disabled when the draft is empty or whitespace', async () => {
    renderWithProviders(<Host />, { services: {} });
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeDisabled();

    await userEvent.type(screen.getByRole('textbox'), '   ');
    expect(send).toBeDisabled();
  });

  it('enables Send once there is non-empty text and submits with no attachment ids', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<Host onSubmit={onSubmit} />, { services: {} });

    await userEvent.type(screen.getByRole('textbox'), 'hello');
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send).toBeEnabled();

    await userEvent.click(send);
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it('submits on Enter and inserts a newline on Shift+Enter', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<Host onSubmit={onSubmit} />, { services: {} });
    const textarea = screen.getByRole('textbox');

    await userEvent.type(textarea, 'hi{Shift>}{Enter}{/Shift}there');
    expect(onSubmit).not.toHaveBeenCalled();
    expect((textarea as HTMLTextAreaElement).value).toBe('hi\nthere');

    await userEvent.type(textarea, '{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('hard-disables sending when `disabled`', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<Host onSubmit={onSubmit} disabled initial="ready" />, {
      services: {},
    });
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});

describe('ChatInput — stop', () => {
  it('shows Stop instead of Send while running and calls onStop', async () => {
    const onStop = vi.fn();
    renderWithProviders(<Host running onStop={onStop} initial="text" />, { services: {} });

    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop generating' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});

describe('ChatInput — attachments', () => {
  it('hides the attach button when no conversationId is set', () => {
    renderWithProviders(<Host />, { services: {} });
    expect(screen.queryByRole('button', { name: 'Attach file' })).not.toBeInTheDocument();
  });

  it('shows the attach button when conversationId is set', () => {
    const { services } = servicesWithUpload();
    renderWithProviders(<Host conversationId="c1" />, { services });
    expect(screen.getByRole('button', { name: 'Attach file' })).toBeInTheDocument();
  });

  it('uploads a picked file, shows its chip, and sends its id on submit', async () => {
    const onSubmit = vi.fn();
    const { services, upload } = servicesWithUpload();
    renderWithProviders(<Host onSubmit={onSubmit} conversationId="c1" />, { services });

    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(upload).toHaveBeenCalledWith('c1', expect.objectContaining({ name: 'shot.png' })),
    );
    // Chip renders the filename (it appears both as chip text and the input value
    // is empty; assert the chip's filename node).
    expect(await screen.findByText('shot.png')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'here');
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSubmit).toHaveBeenCalledWith(['att-1']);
  });

  it('removes a staged chip via its remove button', async () => {
    const { services } = servicesWithUpload();
    renderWithProviders(<Host conversationId="c1" />, { services });

    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    const remove = await screen.findByRole('button', { name: 'Remove shot.png' });
    await userEvent.click(remove);
    expect(screen.queryByText('shot.png')).not.toBeInTheDocument();
  });

  it('shows a toast and blocks Send when a file exceeds the size limit', async () => {
    const { services } = servicesWithUpload();
    renderWithProviders(<Host onSubmit={vi.fn()} conversationId="c1" />, { services });

    // Create a file that exceeds the 10 MB cap (10 * 1024 * 1024 + 1 bytes).
    const bigFile = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.pdf', {
      type: 'application/pdf',
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, bigFile);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('"huge.pdf" is too large (max 10 MB)'),
    );

    // Chip is staged but Send is still disabled even after typing text.
    await userEvent.type(screen.getByRole('textbox'), 'here');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('shows a toast and blocks Send when the upload fails, then re-enables after chip removal', async () => {
    const uploadFn = vi.fn().mockRejectedValue(new Error('500 Internal Server Error'));
    const { services } = servicesWithUpload(uploadFn);
    renderWithProviders(<Host onSubmit={vi.fn()} conversationId="c1" />, { services });

    const file = new File(['x'], 'report.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        '"report.pdf" failed to upload — please try again',
      ),
    );

    // Send is disabled while the errored chip is present.
    await userEvent.type(screen.getByRole('textbox'), 'here');
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

    // Removing the errored chip re-enables Send.
    const remove = await screen.findByRole('button', { name: 'Remove report.pdf' });
    await userEvent.click(remove);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled(),
    );
  });
});

describe('ChatInput — slash popover', () => {
  const flows: PragnaSlashFlow[] = [
    { slashApiName: 'summarize', displayName: 'Summarize', description: 'Summarize a doc' },
    { slashApiName: 'translate', displayName: 'Translate', description: '' },
  ];

  it('does not show the popover when no slashFlows are provided', async () => {
    renderWithProviders(<Host />, { services: {} });
    await userEvent.type(screen.getByRole('textbox'), '/sum');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('opens the popover and filters by the typed query', async () => {
    renderWithProviders(<Host slashFlows={flows} />, { services: {} });
    await userEvent.type(screen.getByRole('textbox'), '/sum');

    const listbox = await screen.findByRole('listbox', { name: 'Slash command suggestions' });
    expect(listbox).toBeInTheDocument();
    expect(screen.getByText('/summarize')).toBeInTheDocument();
    expect(screen.queryByText('/translate')).not.toBeInTheDocument();
  });

  it('accepts a suggestion (rewrites the draft to /{name} ) and Enter does not submit while open', async () => {
    const onSubmit = vi.fn();
    renderWithProviders(<Host onSubmit={onSubmit} slashFlows={flows} />, { services: {} });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

    await userEvent.type(textarea, '/sum');
    await screen.findByRole('listbox');

    // Enter accepts the highlighted item rather than submitting.
    await userEvent.type(textarea, '{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => expect(textarea.value).toBe('/summarize '));
  });
});
