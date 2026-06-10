/** Seed a deterministic create_pdf conversation by running the BACKEND's real
 *  render+persist path (NO LLM). Returns the ids the FE test navigates to.
 *
 *  Ported from the web app suite. Desktop adaptations: the throwaway Postgres
 *  is the `pragna-desktop-e2e` container on host port 5433 (DB `pragna_it`), and
 *  storage is local — exactly the env the desktop BE booted against, so the rows
 *  + bytes the seeder writes are the same ones the FE reads back over the API.
 *
 *  The seeder is invoked with the BE repo as cwd + `PYTHONPATH=.` so
 *  `import src...` resolves, and the throwaway DB's `DATABASE_URL` in the env so
 *  it writes to the same database the BE serves from. */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { TEST_USER } from './env';

// ESM has no __dirname — derive it from this module's URL.
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Backend repo root (where `uv run` + the seeder script live). Overridable. */
const BE_REPO =
  process.env.E2E_BE_REPO ?? '/Users/sgummalla/Desktop/work/repos/pragna2-api';
/** Host port the throwaway Postgres container publishes (desktop stack: 5433). */
const PG_PORT = process.env.E2E_PG_PORT ?? '5433';
/** The throwaway test DB name. */
const PG_DB = process.env.E2E_PG_DB ?? 'pragna_it';

export interface SeededPdf {
  conversation_id: string;
  attachment_id: string;
  filename: string;
}

/** Run the Python seeder against the throwaway DB + local storage. Throws on a
 *  non-zero exit so a seeding failure surfaces as a real test error. */
export function seedPdfConversation(email = TEST_USER.email): SeededPdf {
  const seeder = path.join(HERE, '..', 'scripts', 'seed_pdf_conversation.py');
  const dbUrl = `postgresql+asyncpg://postgres:test@localhost:${PG_PORT}/${PG_DB}`;
  const out = execSync(`uv run python ${seeder} ${email}`, {
    cwd: BE_REPO,
    encoding: 'utf8',
    env: {
      ...process.env,
      // Make `import src...` resolve from the BE repo, and give get_settings()
      // a valid-enough env (dummy secrets — the seeder never verifies tokens or
      // decrypts; it just writes rows + bytes to the same DB/storage the BE
      // booted against).
      PYTHONPATH: '.',
      DATABASE_URL: dbUrl,
      JWT_SECRET: 'e2e-dummy-jwt-secret-value-32chars-min',
      ENCRYPTION_KEY: '0'.repeat(64),
      AUTH_STRATEGY: 'local',
      APP_ENV: 'dev',
      STORAGE_TYPE: 'local',
      LOG_TO_FILE: 'false',
      LOKI_URL: '',
    },
  });
  const lastLine = out.trim().split('\n').filter(Boolean).pop() ?? '';
  return JSON.parse(lastLine) as SeededPdf;
}
