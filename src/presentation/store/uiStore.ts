import { create } from 'zustand';

const SETTINGS_PANE_COLLAPSED_KEY = 'pragna:settings-pane-collapsed';
const CHAT_PANE_COLLAPSED_KEY = 'pragna:chat-pane-collapsed';

/** Read a persisted boolean flag from localStorage (false when unavailable). */
function readPersistedFlag(key: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(key) === '1';
}

/** Persist a boolean flag to localStorage, ignoring storage errors. */
function persistFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

interface UiState {
  /** Whether the settings sidebar is collapsed to icon-only mode. */
  settingsPaneCollapsed: boolean;
  toggleSettingsPane: () => void;
  setSettingsPaneCollapsed: (value: boolean) => void;
  /** Whether the chat conversation sidebar (desktop rail) is collapsed. */
  chatPaneCollapsed: boolean;
  toggleChatPane: () => void;
  setChatPaneCollapsed: (value: boolean) => void;
}

/**
 * Minimal UI store. Persists the sidebar collapse choices (settings + chat) so
 * they survive navigation. Theme/palette are handled by the app's static
 * shadcn + tweakcn theme — not here.
 */
export const useUiStore = create<UiState>((set) => ({
  settingsPaneCollapsed: readPersistedFlag(SETTINGS_PANE_COLLAPSED_KEY),

  toggleSettingsPane: () =>
    set((state) => {
      const next = !state.settingsPaneCollapsed;
      persistFlag(SETTINGS_PANE_COLLAPSED_KEY, next);
      return { settingsPaneCollapsed: next };
    }),

  setSettingsPaneCollapsed: (value) => {
    persistFlag(SETTINGS_PANE_COLLAPSED_KEY, value);
    set({ settingsPaneCollapsed: value });
  },

  chatPaneCollapsed: readPersistedFlag(CHAT_PANE_COLLAPSED_KEY),

  toggleChatPane: () =>
    set((state) => {
      const next = !state.chatPaneCollapsed;
      persistFlag(CHAT_PANE_COLLAPSED_KEY, next);
      return { chatPaneCollapsed: next };
    }),

  setChatPaneCollapsed: (value) => {
    persistFlag(CHAT_PANE_COLLAPSED_KEY, value);
    set({ chatPaneCollapsed: value });
  },
}));
