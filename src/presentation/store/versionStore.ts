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

  setResult: (
    status: CompatStatus,
    serverVersion: string | null,
    serverCompat: string | null,
  ) => void;
  dismiss: () => void;
}

export const useVersionStore = create<VersionState>((set) => ({
  status: 'unknown',
  serverVersion: null,
  serverCompat: null,
  dismissed: false,

  setResult: (status, serverVersion, serverCompat) =>
    set({ status, serverVersion, serverCompat }),
  dismiss: () => set({ dismissed: true }),
}));
