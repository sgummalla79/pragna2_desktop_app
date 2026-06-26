import { APP_VERSION } from './api';

// Client identity headers attached to every backend request so the API can run
// the version-compatibility handshake. Names must match the API's constants
// (nexus-kit-api/src/constants.py).
export const CLIENT_VERSION_HEADER = 'X-Client-Version';
export const CLIENT_APP_HEADER = 'X-Client-App';

// Identifies this client to the API (logged server-side).
export const CLIENT_APP_NAME = 'desktop';

// This client's own version. Single source of truth is package.json (kept in
// sync with src-tauri/tauri.conf.json + Cargo.toml), injected at build time via
// Vite (see APP_VERSION in ./api).
export const CLIENT_VERSION = APP_VERSION;

// Release-line codenames per MAJOR (V1 = Amber, V2 = Beryl, V3 = Citrine, …).
// The current name is DERIVED from this client's MAJOR version — never
// hand-maintained; it changes only when a new major line forks. The A→Z gemstone
// table is fixed reference data. See
// nexus-kit-api/docs/architecture/version-compatibility.md §8.
const RELEASE_CODENAMES = [
  'Amber', 'Beryl', 'Citrine', 'Diamond', 'Emerald', 'Fluorite', 'Garnet',
  'Hematite', 'Iolite', 'Jade', 'Kunzite', 'Lapis', 'Moonstone', 'Nephrite',
  'Opal', 'Peridot', 'Quartz', 'Ruby', 'Sapphire', 'Topaz', 'Uvarovite',
  'Variscite', 'Wulfenite', 'Xenotime', 'Yooperlite', 'Zircon',
] as const;

/** The release-line codename for this client's MAJOR version (V1 = Amber, …). */
export const RELEASE_CODENAME =
  RELEASE_CODENAMES[(Number(CLIENT_VERSION.split('.')[0]) || 1) - 1] ??
  RELEASE_CODENAMES[0];

// Minimum API MAJOR.MINOR ("compat") this build of the client requires. Bump
// this when the client starts depending on a newer API contract. Kept at the
// baseline line for now so no false "update the server" warning is shown.
export const REQUIRED_API_COMPAT = '1.0';
