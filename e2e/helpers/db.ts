/** psql via `docker exec` against the throwaway test Postgres container.
 *  Used by Tier-2 specs that need to assert/seed DB state directly (create
 *  round-trip, cascade-on-delete, save round-trip).
 *
 *  Why stdin instead of `-c "..."`: SQL via template literals contains
 *  newlines; JSON.stringify turns them into literal `\n` inside the
 *  shell-quoted string, which psql sees as a syntax error. Stdin avoids the
 *  shell escaping problem entirely.
 *
 *  Errors are NOT swallowed — a `docker exec` / psql failure throws so a test
 *  assertion sees a real error, not a baffling empty string. */
import { execSync } from 'node:child_process';

import { PG_CONTAINER, TEST_DB } from './env';

/** Run a psql command (via stdin) and return its raw stdout. Throws on
 *  non-zero exit so test assertions see real errors, not empty strings. */
export function psql(sql: string): string {
  return execSync(`docker exec -i ${PG_CONTAINER} psql -U postgres -d ${TEST_DB} -tA`, {
    encoding: 'utf8',
    input: sql,
  }).trim();
}

/** Parse psql `-tA` output (pipe-separated columns, newline-separated rows)
 *  into row arrays. */
export function psqlRows(sql: string): string[][] {
  const out = psql(sql);
  if (!out) return [];
  return out.split('\n').map((l) => l.split('|'));
}

/** Common DB assertions. The agent definition is inlined onto `flow_nodes`
 *  (BE migration 0030 — the `user_agents` table is gone); an "agent node" is a
 *  `flow_node` with a non-NULL `user_model_id`, while deterministic nodes
 *  (mcp_connector / decision) leave it NULL. */
export const db = {
  flowCount: () => Number(psql('SELECT COUNT(*) FROM flows;')) || 0,
  agentNodeCount: () =>
    Number(psql('SELECT COUNT(*) FROM flow_nodes WHERE user_model_id IS NOT NULL;')) || 0,
  flowNodes: (flowApiName: string) =>
    psqlRows(
      `SELECT api_name FROM flow_nodes
       WHERE flow_id = (SELECT id FROM flows WHERE api_name='${flowApiName}')
       ORDER BY api_name;`,
    ),
};
