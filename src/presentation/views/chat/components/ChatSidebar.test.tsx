import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';

// Drive the platform branch directly; stub the data-backed children so the test
// is fast and deterministic (no services / network).
vi.mock('@/infrastructure/platform', () => ({ usesWindowsChrome: vi.fn() }));
vi.mock('./ConversationList', () => ({ ConversationList: () => <div data-testid="conversation-list" /> }));
vi.mock('./AvatarMenu', () => ({ AvatarMenu: () => <div data-testid="avatar-menu" /> }));

import { ChatSidebar } from './ChatSidebar';
import { usesWindowsChrome } from '@/infrastructure/platform';

const mockUsesWindowsChrome = vi.mocked(usesWindowsChrome);

describe('ChatSidebar — platform-conditional chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the Windows-only "Chats" nav item when usesWindowsChrome() is true', () => {
    mockUsesWindowsChrome.mockReturnValue(true);
    renderWithProviders(<ChatSidebar />);

    expect(screen.getByRole('button', { name: 'Chats' })).toBeInTheDocument();
    // Shared affordance present on both platforms (sanity).
    expect(screen.getByRole('button', { name: /New Chat/i })).toBeInTheDocument();
  });

  it('omits the Windows-only "Chats" nav item when usesWindowsChrome() is false (macOS / browser)', () => {
    mockUsesWindowsChrome.mockReturnValue(false);
    renderWithProviders(<ChatSidebar />);

    expect(screen.queryByRole('button', { name: 'Chats' })).toBeNull();
    expect(screen.getByRole('button', { name: /New Chat/i })).toBeInTheDocument();
  });
});
