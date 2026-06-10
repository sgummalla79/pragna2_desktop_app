/**
 * Scenario 29 — Knowledge settings page: create a library + delete (cascade).
 *
 * Ported from the web app's e2e suite. Libraries are defined at
 * `/settings/knowledge` and referenced by agents/flows. Two automatable slices:
 *  - Create a library (no embeddings) → DB row → **Delete** (archives it).
 *  - Delete **cascades**: a seeded agent binding is removed when the library is
 *    deleted.
 * Ingesting a document needs a real VOYAGE key → manual doc.
 *
 * Desktop adaptation: auth comes from the seed-token `page` fixture (no login
 * form), so there is no `login()` call. The DOM (kb-name / kb-slug inputs, the
 * "New library" / "Create library" buttons, the per-card "Delete <name>"
 * ConfirmButton + alertdialog) matches the web app's KnowledgeView 1:1.
 */
import { test, expect } from '../fixtures';
import { psql } from '../helpers/db';
import { TEST_USER } from '../helpers/env';

test.describe.configure({ mode: 'serial' });

const CREATE_SLUG = 'e2e-create-lib';
const SEEDED_ID = '29292929-2929-2929-2929-292929292929';
const SEEDED_SLUG = 'e2e-seeded-lib';
const SEEDED_NAME = 'E2E Seeded Library';
const AGENT_API_NAME = 'e2e-kn-cascade-agent';

function userId(): string {
  return `(SELECT id FROM users WHERE email = '${TEST_USER.email}')`;
}

test.describe('Scenario 29 — Manage a knowledge library', () => {
  test.beforeEach(() => {
    psql(`DELETE FROM agents WHERE api_name = '${AGENT_API_NAME}';`);
    psql(`DELETE FROM knowledge_libraries WHERE slug IN ('${CREATE_SLUG}', '${SEEDED_SLUG}');`);
    psql(`DELETE FROM knowledge_libraries WHERE id = '${SEEDED_ID}';`);
  });

  test('create a library, then delete it', async ({ page }) => {
    await page.goto('/settings/knowledge', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /New library/i }).click();
    await page.locator('#kb-name').fill('E2E Created Library');
    await page.locator('#kb-slug').fill(CREATE_SLUG);
    await page.getByRole('button', { name: 'Create library' }).click();

    await expect
      .poll(() => psql(`SELECT count(*) FROM knowledge_libraries WHERE slug = '${CREATE_SLUG}';`))
      .toBe('1');
    // Anchor to start so this matches only the card's expand button, not the
    // "Delete E2E Created Library" ConfirmButton (whose name starts "Delete").
    const card = page.getByRole('button', { name: /^E2E Created Library/ });
    await expect(card).toBeVisible();

    // Delete (icon ConfirmButton → alertdialog) → archived.
    await page.getByRole('button', { name: 'Delete E2E Created Library' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    await expect
      .poll(() => psql(`SELECT status FROM knowledge_libraries WHERE slug = '${CREATE_SLUG}';`))
      .toBe('archived');
    await expect(card).toHaveCount(0);
  });

  test('deleting a library cascades to its agent reference', async ({ page }) => {
    // Seed a library + an agent that references it.
    psql(
      `INSERT INTO knowledge_libraries
         (id, user_id, slug, name, embedding_model, embedding_dimensions, status)
       VALUES ('${SEEDED_ID}', ${userId()}, '${SEEDED_SLUG}', '${SEEDED_NAME}',
               'voyage-3-large', 1024, 'active');`,
    );
    psql(
      `INSERT INTO agents (id, user_id, api_name, display_name, system_prompt, status)
       VALUES (gen_random_uuid(), ${userId()}, '${AGENT_API_NAME}', 'Cascade Agent',
               'You help.', 'active');`,
    );
    psql(
      `INSERT INTO agent_knowledge_libraries (id, agent_id, library_id)
       VALUES (gen_random_uuid(),
               (SELECT id FROM agents WHERE api_name = '${AGENT_API_NAME}'),
               '${SEEDED_ID}');`,
    );

    await page.goto('/settings/knowledge', { waitUntil: 'networkidle' });

    const card = page.getByRole('button', { name: new RegExp(`^${SEEDED_NAME}`) });
    await expect(card).toBeVisible();
    await page.getByRole('button', { name: `Delete ${SEEDED_NAME}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();

    // Library archived AND the agent reference removed (cascade).
    await expect
      .poll(() => psql(`SELECT status FROM knowledge_libraries WHERE id = '${SEEDED_ID}';`))
      .toBe('archived');
    await expect
      .poll(() =>
        psql(`SELECT count(*) FROM agent_knowledge_libraries WHERE library_id = '${SEEDED_ID}';`),
      )
      .toBe('0');
  });
});
