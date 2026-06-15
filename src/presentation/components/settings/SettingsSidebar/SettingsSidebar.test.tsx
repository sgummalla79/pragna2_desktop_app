import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/__tests__/renderWithProviders';
import { useUiStore } from '@/presentation/store/uiStore';

// Drive the platform branch; stub the sidebar primitives. The Sidebar mock
// renders its `headerContent` so we can assert the Windows-only gear header.
vi.mock('@/infrastructure/platform', () => ({ usesWindowsChrome: vi.fn() }));
vi.mock('@/components/ui/sidebar/TitlebarCollapseToggle', () => ({
  TitlebarCollapseToggle: () => <div data-testid="titlebar-collapse-toggle" />,
}));
vi.mock('@/components/ui/sidebar/Sidebar', () => ({
  Sidebar: ({ headerContent }: { headerContent?: React.ReactNode }) => (
    <div data-testid="sidebar">{headerContent}</div>
  ),
  ItemList: () => <div data-testid="item-list" />,
}));

import { SettingsSidebar } from './SettingsSidebar';
import { usesWindowsChrome } from '@/infrastructure/platform';

const mockUsesWindowsChrome = vi.mocked(usesWindowsChrome);

describe('SettingsSidebar — platform-conditional chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Expanded rail so the Windows gear header (headerContent) renders.
    useUiStore.setState({ settingsPaneCollapsed: false });
  });

  it('renders the Windows-only "Settings" gear header and no macOS overlay toggle', () => {
    mockUsesWindowsChrome.mockReturnValue(true);
    renderWithProviders(<SettingsSidebar />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.queryByTestId('titlebar-collapse-toggle')).toBeNull();
  });

  it('renders the macOS overlay TitlebarCollapseToggle and no gear header when not Windows chrome', () => {
    mockUsesWindowsChrome.mockReturnValue(false);
    renderWithProviders(<SettingsSidebar />);

    expect(screen.getByTestId('titlebar-collapse-toggle')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).toBeNull();
  });
});
