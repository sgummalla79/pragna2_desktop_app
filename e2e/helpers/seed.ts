/** Seed a deterministic create_pdf conversation by running the BACKEND's real
 *  render+persist path (NO LLM). Returns the ids the FE test navigates to.
 *
 *  The seeder script itself is fully env-driven — it reads the database from
 *  `get_settings()`'s `DATABASE_URL` and storage from `STORAGE_TYPE` /
 *  `STORAGE_LOCAL_PATH`. So "where to seed" is entirely a matter of which env
 *  the seeder runs with; nothing about the target is baked into this helper.
 *
 *  Two modes (chosen by `E2E_BE_CONTAINER`):
 *
 *  - **In-container (preferred for a containerised BE).** Run the seeder INSIDE
 *    the BE container, inheriting that container's OWN `DATABASE_URL` + storage
 *    location (read from `docker inspect`, never hardcoded). This is required
 *    when the BE runs in Docker: the seeded PDF bytes must land in the same
 *    storage volume the BE serves from, and the DB creds are the container's —
 *    so the rows + bytes the FE reads back are exactly the ones written.
 *
 *  - **Host (legacy local stack).** Run the seeder from the BE repo against a
 *    reachable Postgres. Every connection part (`E2E_PG_HOST/PORT/DB/USER/
 *    PASSWORD`) is env-configurable; the helper builds no literal credentials.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEST_USER } from './env';

// ESM has no __dirname — derive it from this module's URL.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEEDER = path.join(HERE, '..', 'scripts', 'seed_pdf_conversation.py');

/** When set, seed inside this BE container, sourcing its real DB + storage
 *  config. When unset, fall back to the host path. */
const BE_CONTAINER = process.env.E2E_BE_CONTAINER;

/** Backend repo root for the host path (where `uv run` + the BE code live). */
const BE_REPO =
  process.env.E2E_BE_REPO ?? '/Users/sgummalla/Desktop/work/repos/nexus-kit-api';

// Host-connection parts — only used when E2E_BE_CONTAINER is unset. Defaults
// keep the legacy local stack working; no credential is baked into the URL.
const PG_HOST = process.env.E2E_PG_HOST ?? 'localhost';
const PG_PORT = process.env.E2E_PG_PORT ?? '5433';
const PG_DB = process.env.E2E_PG_DB ?? 'pragna_it';
const PG_USER = process.env.E2E_PG_USER ?? 'postgres';
const PG_PASSWORD = process.env.E2E_PG_PASSWORD ?? 'test';

export interface SeededPdf {
  conversation_id: string;
  attachment_id: string;
  filename: string;
}

/** Settings `get_settings()` must LOAD to import, but the seeder never USES (it
 *  writes rows + bytes — it never verifies a token or decrypts). The DB +
 *  storage values are the only ones that must be real; those are supplied
 *  per-mode. `AUTH_STRATEGY=local` avoids pulling in any Auth0 field validation. */
const SEEDER_DUMMY_ENV: Record<string, string> = {
  JWT_SECRET: 'e2e-dummy-jwt-secret-value-32chars-min',
  ENCRYPTION_KEY: '0'.repeat(64),
  AUTH_STRATEGY: 'local',
  APP_ENV: 'dev',
  LOG_TO_FILE: 'false',
  LOKI_URL: '',
};

/** Read one env var the container was configured with (its real value, not a
 *  hardcoded guess). Empty string if absent. */
function containerEnv(container: string, name: string): string {
  const out = execSync(
    `docker inspect ${container} --format '{{range .Config.Env}}{{println .}}{{end}}'`,
    { encoding: 'utf8' },
  );
  const line = out.split('\n').find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1) : '';
}

/** The seeder prints one JSON line last; tolerate BE log noise before it. */
function lastJsonLine(out: string): SeededPdf {
  const lastLine = out.trim().split('\n').filter(Boolean).pop() ?? '';
  return JSON.parse(lastLine) as SeededPdf;
}

/** Run the Python seeder. Throws on a non-zero exit so a seeding failure
 *  surfaces as a real test error. */
export function seedPdfConversation(email = TEST_USER.email): SeededPdf {
  return BE_CONTAINER ? seedInContainer(email, BE_CONTAINER) : seedOnHost(email);
}

/** Run the seeder INSIDE the BE container, inheriting the container's real
 *  `DATABASE_URL` + storage location so the seeded rows + bytes land exactly
 *  where the BE reads them — no hardcoded creds, no host/container storage split. */
function seedInContainer(email: string, container: string): SeededPdf {
  const databaseUrl = containerEnv(container, 'DATABASE_URL');
  if (!databaseUrl) {
    throw new Error(
      `seedPdfConversation: container '${container}' exposes no DATABASE_URL in its config`,
    );
  }
  const storageType = containerEnv(container, 'STORAGE_TYPE') || 'local';
  const storageLocalPath = containerEnv(container, 'STORAGE_LOCAL_PATH');

  execSync(`docker cp ${SEEDER} ${container}:/tmp/seed_pdf_conversation.py`, {
    stdio: 'pipe',
  });

  const env: Record<string, string> = {
    ...SEEDER_DUMMY_ENV,
    DATABASE_URL: databaseUrl,
    STORAGE_TYPE: storageType,
    ...(storageLocalPath ? { STORAGE_LOCAL_PATH: storageLocalPath } : {}),
    PYTHONPATH: '/app',
  };
  const envFlags = Object.entries(env)
    .map(([k, v]) => `-e ${k}=${JSON.stringify(v)}`)
    .join(' ');

  const out = execSync(
    `docker exec -w /app ${envFlags} ${container} python /tmp/seed_pdf_conversation.py ${email}`,
    { encoding: 'utf8' },
  );
  return lastJsonLine(out);
}

/** Legacy host path: run the seeder from the BE repo against a reachable
 *  Postgres, every connection part env-configurable. */
function seedOnHost(email: string): SeededPdf {
  const dbUrl = `postgresql+asyncpg://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
  const out = execSync(`uv run python ${SEEDER} ${email}`, {
    cwd: BE_REPO,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...SEEDER_DUMMY_ENV,
      DATABASE_URL: dbUrl,
      STORAGE_TYPE: 'local',
      PYTHONPATH: '.',
    },
  });
  return lastJsonLine(out);
}
