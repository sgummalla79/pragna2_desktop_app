import { APP_VERSION } from './api';

// Client identity headers attached to every backend request so the API can run
// the version-compatibility handshake. Names must match the API's constants
// (pragna2-api/src/constants.py).
export const CLIENT_VERSION_HEADER = 'X-Client-Version';
export const CLIENT_APP_HEADER = 'X-Client-App';

// Identifies this client to the API (logged server-side).
export const CLIENT_APP_NAME = 'desktop';

// This client's own version. Single source of truth is package.json (kept in
// sync with src-tauri/tauri.conf.json + Cargo.toml), injected at build time via
// Vite (see APP_VERSION in ./api).
export const CLIENT_VERSION = APP_VERSION;

// Minimum API MAJOR.MINOR ("compat") this build of the client requires. Bump
// this when the client starts depending on a newer API contract. Kept at the
// baseline line for now so no false "update the server" warning is shown.
export const REQUIRED_API_COMPAT = '1.0';
