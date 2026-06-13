import { create } from 'zustand';

/** Outcome of the client→API version-compatibility handshake. */
export type CompatStatus =
  | 'unknown' // not yet checked
  | 'ok' // compatible
  | 'server_outdated' // API older than this client requires
  | 'client_outdated' // this client older than the API still serves
  | 'unreachable'; // version card could not be fetched (never blocks the UI)

interface VersionState {
  status: CompatStatus;
  serverVersion: string | null;
  serverCompat: string | null;
  dismissed: boolean;

  // Phase 3 (enforcement): set when the API actively rejects this client with
  // 426 Upgrade Required. Drives a non-dismissible blocking screen. Dormant
  // until the operator raises MIN_CLIENT_COMPAT on the API.
  blocked: boolean;
  blockMessage: string | null;

  setResult: (
    status: CompatStatus,
    serverVersion: string | null,
    serverCompat: string | null,
  ) => void;
  dismiss: () => void;
  setBlocked: (message: string) => void;
}

export const useVersionStore = create<VersionState>((set) => ({
  status: 'unknown',
  serverVersion: null,
  serverCompat: null,
  dismissed: false,
  blocked: false,
  blockMessage: null,

  setResult: (status, serverVersion, serverCompat) =>
    set({ status, serverVersion, serverCompat }),
  dismiss: () => set({ dismissed: true }),
  setBlocked: (message) => set({ blocked: true, blockMessage: message }),
}));
