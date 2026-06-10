/** Playwright global setup: log in ONCE against the local BE and persist the
 *  seed token pair for the per-test fixture. Runs after `pnpm run setup` has
 *  brought the stack up and registered the test user. Failing here (e.g. the BE
 *  is down or the user doesn't exist) aborts the whole run with a clear error
 *  rather than letting every spec fail confusingly mid-flight. */
import { mintSeedTokens, writeTokens } from './helpers/tokens';

export default async function globalSetup(): Promise<void> {
  const tokens = await mintSeedTokens();
  writeTokens(tokens);
}
