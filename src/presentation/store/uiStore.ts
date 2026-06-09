import { create } from 'zustand';

const SETTINGS_PANE_COLLAPSED_KEY = 'pragna:settings-pane-collapsed';

function readInitialSettingsCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SETTINGS_PANE_COLLAPSED_KEY) === '1';
}

interface UiState {
  /** Whether the settings sidebar is collapsed to icon-only mode. */
  settingsPaneCollapsed: boolean;
  toggleSettingsPane: () => void;
  setSettingsPaneCollapsed: (value: boolean) => void;
}

/**
 * Minimal UI store. Only persists the settings sidebar collapse choice so it
 * survives navigation between settings sub-views. Theme/palette are handled by
 * the app's static shadcn + tweakcn theme — not here.
 */
export const useUiStore = create<UiState>((set) => ({
  settingsPaneCollapsed: readInitialSettingsCollapsed(),

  toggleSettingsPane: () =>
    set((state) => {
      const next = !state.settingsPaneCollapsed;
      try {
        window.localStorage.setItem(SETTINGS_PANE_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return { settingsPaneCollapsed: next };
    }),

  setSettingsPaneCollapsed: (value) => {
    try {
      window.localStorage.setItem(SETTINGS_PANE_COLLAPSED_KEY, value ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    set({ settingsPaneCollapsed: value });
  },
}));
