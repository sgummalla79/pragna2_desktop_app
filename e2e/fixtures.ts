/** Authenticated Playwright fixtures. Every test that imports `test`/`expect`
 *  from here starts with the seed token already present in sessionStorage, so
 *  `AuthService.bootstrap()` restores the session on the first page load — no
 *  login UI, no Auth0 round-trip.
 *
 *  `storageState` can't carry this: it only persists localStorage + cookies,
 *  and the FE's `tokenStorage` uses **sessionStorage**. So we inject via
 *  `addInitScript`, which runs before any page script — the tokens are in place
 *  before React (and `useBootstrap`) reads them. */
import { test as base, expect } from '@playwright/test';

import { TOKEN_KEYS } from './helpers/env';
import { readTokens } from './helpers/tokens';

export const test = base.extend({
  page: async ({ page }, use) => {
    const { accessToken, idToken } = readTokens();
    await page.addInitScript(
      ([atKey, idtKey, at, idt]) => {
        sessionStorage.setItem(atKey, at);
        sessionStorage.setItem(idtKey, idt);
      },
      [TOKEN_KEYS.accessToken, TOKEN_KEYS.idToken, accessToken, idToken] as const,
    );
    await use(page);
  },
});

export { expect };
