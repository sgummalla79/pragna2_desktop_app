import type { ReactNode } from 'react';

/**
 * Union discriminating every item kind the Sidebar can render.
 * Add a new member here to introduce a new menu style — the Sidebar switch
 * delegates rendering to the matching component automatically.
 */
export type SidebarItemConfig =
  | { type: 'back';    to: string; label: string }
  | { type: 'section'; label: string }
  | { type: 'nav';     to: string; icon: ReactNode; label: string }
  | { type: 'divider' };
