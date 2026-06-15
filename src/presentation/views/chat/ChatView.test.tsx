import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { useUiStore } from '@/presentation/store/uiStore';

// Drive the platform branch; stub the heavy children so the test exercises only
// ChatView's own chrome (the macOS-only "Search chats" title-bar button).
vi.mock('@/infrastructure/platform', () => ({ usesWindowsChrome: vi.fn() }));
vi.mock('./components/ChatSidebar', () => ({ ChatSidebar: () => <div data-testid="chat-sidebar" /> }));
vi.mock('./components/ChatsSearchModal', () => ({ ChatsSearchModal: () => <div data-testid="chats-search-modal" /> }));
vi.mock('./components/AvatarMenu', () => ({ AvatarMenu: () => <div data-testid="avatar-menu" /> }));
vi.mock('@/components/ui/sidebar/TitlebarCollapseToggle', () => ({
  TitlebarCollapseToggle: () => <div data-testid="titlebar-collapse-toggle" />,
}));

import { ChatView } from './ChatView';
import { usesWindowsChrome } from '@/infrastructure/platform';

const mockUsesWindowsChrome = vi.mocked(usesWindowsChrome);

describe('ChatView — platform-conditional chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ chatPaneCollapsed: false });
  });

  it('renders the macOS-only "Search chats" title-bar button when not Windows chrome', () => {
    mockUsesWindowsChrome.mockReturnValue(false);
    renderWithProviders(<ChatView />);

    expect(screen.getByRole('button', { name: /Search chats/i })).toBeInTheDocument();
    // The macOS overlay collapse toggle renders too (Windows inlines it instead).
    expect(screen.getByTestId('titlebar-collapse-toggle')).toBeInTheDocument();
  });

  it('omits the "Search chats" title-bar button when usesWindowsChrome() is true', () => {
    mockUsesWindowsChrome.mockReturnValue(true);
    renderWithProviders(<ChatView />);

    expect(screen.queryByRole('button', { name: /Search chats/i })).toBeNull();
    expect(screen.queryByTestId('titlebar-collapse-toggle')).toBeNull();
  });
});
