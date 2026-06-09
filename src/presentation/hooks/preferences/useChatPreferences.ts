import { useSyncExternalStore } from 'react';

/**
 * User-controlled chat-UX preferences.
 *
 * Stored in ``localStorage`` (not the backend) — these are "shape my UI"
 * toggles that don't need cross-device sync. If we later want cross-device sync
 * we can promote to a ``users.preferences JSONB`` column and the hook surface
 * stays the same.
 *
 * Two flags today:
 *   - ``branchEnabled``: show the Branch button on user turns.
 *   - ``regenWithModelEnabled``: show the dropdown chevron next to Regenerate
 *     for per-turn model overrides.
 *
 * Both default to ``true``. Power users hide what they don't want.
 *
 * Persistence semantics:
 *   - One ``localStorage`` key, one JSON blob (``pragna:chat-prefs``).
 *   - ``useSyncExternalStore`` keeps every mounted hook in sync via the
 *     ``storage`` event AND a custom in-page event the setter dispatches (the
 *     ``storage`` event only fires on OTHER tabs/windows).
 */

const STORAGE_KEY = 'pragna:chat-prefs';
const CHANGE_EVENT = 'pragna:chat-prefs:change';

export interface ChatPreferences {
  /** Show the Branch button on user-turn hover. */
  branchEnabled: boolean;
  /** Show the regen-with-model dropdown next to Regenerate. */
  regenWithModelEnabled: boolean;
}

const DEFAULTS: ChatPreferences = {
  branchEnabled: true,
  regenWithModelEnabled: true,
};

/** Reads and normalizes the persisted preferences, falling back to defaults. */
function readPrefs(): ChatPreferences {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ChatPreferences>;
    return {
      branchEnabled: parsed.branchEnabled ?? DEFAULTS.branchEnabled,
      regenWithModelEnabled:
        parsed.regenWithModelEnabled ?? DEFAULTS.regenWithModelEnabled,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Persists the preferences and notifies in-page subscribers. */
function writePrefs(next: ChatPreferences): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Subscribes to cross-tab (storage) and in-page (custom event) changes. */
function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (e: Event) => {
    if (e instanceof StorageEvent && e.key !== STORAGE_KEY) return;
    onChange();
  };
  window.addEventListener('storage', handler);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}

// Snapshot must be stable across calls when nothing changed, so
// useSyncExternalStore doesn't tear. We memoize the last-returned object and
// only allocate a new one when the underlying JSON differs.
let lastSerialized = '';
let lastSnapshot: ChatPreferences = DEFAULTS;

/** Returns a referentially-stable snapshot of the current preferences. */
function getSnapshot(): ChatPreferences {
  const next = readPrefs();
  const serialized = JSON.stringify(next);
  if (serialized !== lastSerialized) {
    lastSerialized = serialized;
    lastSnapshot = next;
  }
  return lastSnapshot;
}

/** Server snapshot (no localStorage) — always the defaults. */
function getServerSnapshot(): ChatPreferences {
  return DEFAULTS;
}

export interface UseChatPreferencesReturn {
  prefs: ChatPreferences;
  setPref: <K extends keyof ChatPreferences>(
    key: K,
    value: ChatPreferences[K],
  ) => void;
}

/** Subscribe to chat-UX preferences with live updates across tabs + hooks. */
export function useChatPreferences(): UseChatPreferencesReturn {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    prefs,
    setPref: (key, value) => {
      writePrefs({ ...prefs, [key]: value });
    },
  };
}
