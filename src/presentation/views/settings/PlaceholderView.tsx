import { useLocation } from 'react-router-dom';
import { EntityIcon, type EntityKey } from '@/presentation/components/icons/EntityIcon';
import { ROUTES } from '@/constants/routes';

/** Maps a settings route to its entity icon + title for the placeholder. */
const SECTION: Record<string, { entity: EntityKey; title: string }> = {
  [ROUTES.SETTINGS_CONFIGURATION]: { entity: 'configuration', title: 'Configuration' },
  [ROUTES.SETTINGS_CONNECTORS]: { entity: 'connectors', title: 'Connectors' },
  [ROUTES.SETTINGS_KNOWLEDGE]: { entity: 'knowledge', title: 'Knowledge' },
  [ROUTES.SETTINGS_AGENTS]: { entity: 'agents', title: 'Agents' },
  [ROUTES.SETTINGS_FLOWS]: { entity: 'flows', title: 'Agent Flows' },
  [ROUTES.SETTINGS_APPEARANCE]: { entity: 'appearance', title: 'Appearance' },
  [ROUTES.SETTINGS_PROFILE]: { entity: 'profile', title: 'Profile' },
};

/**
 * Placeholder for settings sections not yet implemented in the desktop app.
 * Renders the section's icon + title and a "coming soon" note.
 */
export default function PlaceholderView() {
  const { pathname } = useLocation();
  const section = SECTION[pathname] ?? { entity: 'configuration' as EntityKey, title: 'Settings' };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-7">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2.5">
          <EntityIcon entity={section.entity} size="lg" />
          {section.title}
        </h1>
      </div>
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-base font-semibold text-foreground">Coming soon</p>
        <p className="text-sm text-muted-foreground">
          {section.title} isn't available in the desktop app yet.
        </p>
      </div>
    </div>
  );
}
