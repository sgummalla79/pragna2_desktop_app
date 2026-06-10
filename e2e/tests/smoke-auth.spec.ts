/**
 * Phase 1 smoke spec — the seed-token auth proof.
 *
 * Goal: prove the whole harness end-to-end with the cheapest possible
 * assertion. A seeded token in sessionStorage must let the app boot straight
 * into an authenticated, protected route (`/chat`) without bouncing to
 * `/login`. This validates: (a) the stack is up, (b) `global-setup` minted a
 * real local-BE access token, (c) the fixture injected it before bootstrap,
 * (d) `me()` resolved the user from the decoded ID token, and (e) `bootstrap`
 * flipped `isAuthenticated` so `ProtectedRoute` rendered the chat surface.
 *
 * No LLM is involved — this never sends a message, so it runs keyless.
 */
import { test, expect } from '../fixtures';

test.describe('Smoke — seed-token auth', () => {
  test('seeded token boots straight into authenticated /chat', async ({ page }) => {
    await page.goto('/chat');

    // The authenticated chat chrome renders: the sidebar "New chat" button is
    // a stable, role-addressable signal that ProtectedRoute let us through.
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({
      timeout: 15_000,
    });

    // And we were NOT redirected to the login page.
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('unseeded context is redirected to /login', async ({ browser }) => {
    // A bare context with NO seeded token must NOT reach /chat — this guards
    // against the smoke test passing for the wrong reason (e.g. auth disabled).
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await ctx.close();
  });
});
