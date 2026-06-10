/**
 * Scenario 30 — Reference a knowledge library on a standalone agent (RAG Rung 2).
 *
 * Ported from the web app. Libraries are defined at Settings → Knowledge and
 * **referenced on demand** on an agent via the agent editor's **Knowledge**
 * section. Seed an agent + a library, then attach/detach the reference (no
 * embeddings needed — a binding is just a join row).
 *
 * Desktop adaptation: auth via the seed-token `page` fixture (no login form);
 * the section testid (`agent-knowledge-attach`) + the "Remove <name>" pill
 * button match the web app 1:1. Knowledge detach is direct (no confirm dialog).
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { TEST_USER } from '../helpers/env';

test.describe.configure({ mode: 'serial' });

const LIBRARY_ID = '30303030-3030-3030-3030-303030303030';
const LIBRARY_NAME = 'E2E Attach Library';
const LIBRARY_SLUG = 'e2e-attach-lib';
const AGENT_API_NAME = 'e2e-attach-kn-agent';
const AGENT_NAME = 'E2E Attach KN Agent';

function bindingCount(): string {
  return psql(
    `SELECT count(*) FROM agent_knowledge_libraries akl
     JOIN agents a ON a.id = akl.agent_id
     WHERE a.api_name = '${AGENT_API_NAME}'
       AND akl.library_id = '${LIBRARY_ID}';`,
  );
}

test.describe('Scenario 30 — Reference a knowledge library on an agent', () => {
  test.beforeEach(() => {
    psql(`DELETE FROM agents WHERE api_name = '${AGENT_API_NAME}';`);
    psql(`DELETE FROM knowledge_libraries WHERE id = '${LIBRARY_ID}';`);
    psql(
      `INSERT INTO knowledge_libraries
         (id, user_id, slug, name, embedding_model, embedding_dimensions, status)
       VALUES ('${LIBRARY_ID}',
               (SELECT id FROM users WHERE email = '${TEST_USER.email}'),
               '${LIBRARY_SLUG}', '${LIBRARY_NAME}', 'voyage-3-large', 1024, 'active');`,
    );
    psql(
      `INSERT INTO agents (id, user_id, api_name, display_name, system_prompt, status)
       VALUES (gen_random_uuid(),
               (SELECT id FROM users WHERE email = '${TEST_USER.email}'),
               '${AGENT_API_NAME}', '${AGENT_NAME}', 'You help.', 'active');`,
    );
  });

  test('attach via the agent editor, then detach', async ({ page }) => {
    await page.goto('/settings/agents', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: `Edit ${AGENT_NAME}` }).click();

    // Attach the library from the picker (Radix Select).
    await page.getByTestId('agent-knowledge-attach').click();
    await page.getByRole('option', { name: LIBRARY_NAME }).click();

    await expect.poll(bindingCount).toBe('1');
    await expect(page.getByText(LIBRARY_NAME)).toBeVisible();

    // Remove the pill (X) → reference removed (the library itself survives).
    await page.getByRole('button', { name: `Remove ${LIBRARY_NAME}` }).click();

    await expect.poll(bindingCount).toBe('0');
    // The library itself is untouched by a detach.
    await expect
      .poll(() => psql(`SELECT status FROM knowledge_libraries WHERE id = '${LIBRARY_ID}';`))
      .toBe('active');
  });
});
