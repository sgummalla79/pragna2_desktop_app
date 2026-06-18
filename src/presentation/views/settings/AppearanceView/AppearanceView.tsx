import { Sun, Moon, Monitor } from 'lucide-react';
import { EntityIcon } from '@/presentation/components/icons/EntityIcon';
import { cn } from '@/lib/utils';
import { APP_NAME } from '@/constants/api';
import { THEME_MODES, type ThemeMode } from '@/constants/theme';
import { useThemeStore } from '@/presentation/store/themeStore';

/** Display metadata for each selectable mode. Icon + label per mode. */
const MODE_META: Record<ThemeMode, { label: string; description: string; Icon: typeof Sun }> = {
  light: { label: 'Light', description: 'Always use the light theme.', Icon: Sun },
  dark: { label: 'Dark', description: 'Always use the dark theme.', Icon: Moon },
  system: { label: 'System', description: 'Match your operating system.', Icon: Monitor },
};

/**
 * Appearance settings page — light / dark / system theme selector.
 *
 * A segmented control bound to {@link useThemeStore}; the store persists the
 * choice and toggles the `.dark` class on `<html>`. Palette/TweakCN import is
 * deferred (see pragna2-tracker TD-026); this page covers the mode toggle only.
 */
export default function AppearanceView() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2.5 text-2xl font-bold">
          <EntityIcon entity="appearance" size="lg" />
          Appearance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how {APP_NAME} looks. “System” follows your operating system’s
          light/dark setting.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Theme</h2>

        {/* Responsive segmented control: stacks on narrow widths, row on >=sm. */}
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
        >
          {THEME_MODES.map((m) => {
            const { label, description, Icon } = MODE_META[m];
            const selected = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                onClick={() => setMode(m)}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-accent',
                )}
              >
                <Icon
                  size={18}
                  aria-hidden
                  className={cn('mt-0.5 flex-shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
