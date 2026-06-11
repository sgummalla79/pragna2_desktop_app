import { Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { Sidebar, ItemList } from '@/components/ui/sidebar/Sidebar';
import { TitlebarCollapseToggle } from '@/components/ui/sidebar/TitlebarCollapseToggle';
import { ROUTES } from '@/constants/routes';
import { useUiStore } from '@/presentation/store/uiStore';
import { isWindowsPlatform } from '@/infrastructure/platform';
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
 * Settings navigation sidebar.
 *
 * Platform differences (governed by {@link isWindowsPlatform}):
 *  - **macOS**: floating {@link TitlebarCollapseToggle} next to the traffic lights.
 *  - **Windows**: inline gear-icon header row (16px top spacer, gear + "Settings"
 *    label left-aligned, collapse/expand toggle right-aligned); no overlay chrome.
 *    When collapsed a narrow icon-only rail is rendered by {@link SettingsLayout}.
 */
export function SettingsSidebar() {
  const collapsed = useUiStore((s) => s.settingsPaneCollapsed);
  const toggle = useUiStore((s) => s.toggleSettingsPane);
  const isWindows = isWindowsPlatform();

  return (
    <>
      {/* macOS: overlay toggle next to traffic lights. */}
      {!isWindows && (
        <TitlebarCollapseToggle
          collapsed={collapsed}
          onToggle={toggle}
          openLabel="Open sidebar"
          collapseLabel="Collapse sidebar"
          flyout={<ItemList items={SETTINGS_NAV} expanded />}
        />
      )}

      {/* Expanded panel (static rail). Hidden when collapsed. */}
      {!collapsed && (
        <Sidebar
          items={SETTINGS_NAV}
          label="Settings navigation"
          flushEdge={isWindows}
          headerContent={
            isWindows ? (
              <>
                {/* Row 1: empty spacer — clears the custom Windows title bar (32px). */}
                <div className="h-8 shrink-0" aria-hidden />

                {/* Row 2: gear icon + "Settings" label left, collapse toggle right. */}
                <div className="flex items-center px-3 pb-3">
                  <SettingsIcon size={20} className="shrink-0 text-foreground" aria-hidden />
                  <span className="ml-2 text-[15px] font-semibold tracking-tight text-foreground">
                    Settings
                  </span>
                  <button
                    type="button"
                    onClick={toggle}
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                    className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-foreground/60 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PanelLeftClose size={14} aria-hidden />
                  </button>
                </div>
              </>
            ) : undefined
          }
        />
      )}

      {/* Windows collapsed rail: narrow icon-only panel with expand + nav icons. */}
      {isWindows && collapsed && (
        <CollapsedSettingsRail onExpand={toggle} items={SETTINGS_NAV} />
      )}
    </>
  );
}

/** Narrow 48px icon-only rail shown on Windows when the settings sidebar is collapsed. */
function CollapsedSettingsRail({
  onExpand,
  items,
}: {
  onExpand: () => void;
  items: SidebarItemConfig[];
}) {
  return (
    <aside
      aria-label="Settings navigation (collapsed)"
      className="flex flex-shrink-0 flex-col items-center overflow-hidden border-r border-border bg-sidebar text-sidebar-foreground shadow-sm"
      style={{
        width: 48,
        minWidth: 48,
        height: '100vh',
        paddingTop: 32,
      }}
    >
      {/* Expand icon */}
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand sidebar"
        title="Expand sidebar"
        className="mb-2 flex h-8 w-8 items-center justify-center rounded text-foreground/60 hover:bg-accent hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PanelLeftOpen size={16} aria-hidden />
      </button>

      {/* Nav icons — scrollable, fills remaining space */}
      <div className="flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto w-full">
        <ItemList items={items.filter((i) => i.type === 'nav')} expanded={false} />
      </div>

      {/* Back to Chat — pinned to the bottom */}
      <div className="flex flex-col items-center gap-0.5 pb-2 w-full">
        <ItemList items={items.filter((i) => i.type === 'back')} expanded={false} />
      </div>
    </aside>
  );
}
