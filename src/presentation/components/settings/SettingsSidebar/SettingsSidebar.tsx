import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Sidebar, ItemList } from '@/components/ui/sidebar/Sidebar';
import { TitlebarCollapseToggle } from '@/components/ui/sidebar/TitlebarCollapseToggle';
import { ROUTES } from '@/constants/routes';
import { useUiStore } from '@/presentation/store/uiStore';
import type { SidebarItemConfig } from '@/components/ui/sidebar/types';

/** Settings navigation config — add/remove items here; styling never changes. */
const SETTINGS_NAV: SidebarItemConfig[] = [
  { type: 'section', label: 'AI Setup' },
  { type: 'nav', to: ROUTES.SETTINGS_CONFIGURATION, icon: <EntityIcon entity="configuration" />, label: 'Configuration' },
  { type: 'nav', to: ROUTES.SETTINGS_PROVIDERS, icon: <EntityIcon entity="providers" />, label: 'Providers' },
  { type: 'nav', to: ROUTES.SETTINGS_CONNECTORS, icon: <EntityIcon entity="connectors" />, label: 'Connectors' },
  { type: 'nav', to: ROUTES.SETTINGS_KNOWLEDGE, icon: <EntityIcon entity="knowledge" />, label: 'Knowledge' },
  { type: 'section', label: 'Build' },
  { type: 'nav', to: ROUTES.SETTINGS_AGENTS, icon: <EntityIcon entity="agents" />, label: 'Agents' },
  { type: 'nav', to: ROUTES.SETTINGS_FLOWS, icon: <EntityIcon entity="flows" />, label: 'Agent Flows' },
  { type: 'section', label: 'Account' },
  { type: 'nav', to: ROUTES.SETTINGS_APPEARANCE, icon: <EntityIcon entity="appearance" />, label: 'Appearance' },
  { type: 'nav', to: ROUTES.SETTINGS_PROFILE, icon: <EntityIcon entity="profile" />, label: 'Profile' },
  // Pinned to the bottom of the rail by Sidebar (mirrors the chat avatar footer).
  { type: 'back', to: ROUTES.CHAT, label: 'Back to Chat' },
];

/**
 * Settings navigation, macOS-style:
 *  - A collapse/expand toggle ({@link TitlebarCollapseToggle}) lives next to the
 *    traffic lights.
 *  - Expanded: the full static sidebar panel shows; the toggle collapses it.
 *  - Collapsed: the panel is hidden; clicking the toggle pins it open, and
 *    HOVERING the toggle reveals the nav as a floating flyout menu.
 */
export function SettingsSidebar() {
  const collapsed = useUiStore((s) => s.settingsPaneCollapsed);
  const toggle = useUiStore((s) => s.toggleSettingsPane);

  return (
    <>
      <TitlebarCollapseToggle
        collapsed={collapsed}
        onToggle={toggle}
        openLabel="Open sidebar"
        collapseLabel="Collapse sidebar"
        flyout={<ItemList items={SETTINGS_NAV} expanded />}
      />

      {/* Expanded panel (static rail). Hidden when collapsed. */}
      {!collapsed && <Sidebar items={SETTINGS_NAV} label="Settings navigation" />}
    </>
  );
}
