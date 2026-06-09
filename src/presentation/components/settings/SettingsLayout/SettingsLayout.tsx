import { Outlet } from 'react-router-dom';

import { SettingsSidebar } from '../SettingsSidebar/SettingsSidebar';

/**
 * Settings shell. The collapse/expand toggle lives in the title bar
 * (see {@link SettingsSidebar}); this layout is just the sidebar panel + the
 * scrollable content area. All surfaces use theme tokens only.
 */
export function SettingsLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <SettingsSidebar />
      <main className="flex-1 overflow-y-auto text-card-foreground">
        <Outlet />
      </main>
    </div>
  );
}
