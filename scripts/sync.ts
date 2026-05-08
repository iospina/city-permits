// ---------------------------------------------------------------------------
// scripts/sync.ts
// Run the permit sync against the dev database from your terminal.
//
//   npm run db:sync
//
// Wraps the same runSync() the cron handler calls in production. Useful for
// populating a fresh dev DB and for sanity-checking the sync after schema
// changes without waiting for the daily cron.
// ---------------------------------------------------------------------------

import { runSync } from '../lib/sync';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local.');
  }

  console.info('Starting sync …');
  const result = await runSync();
  console.info(
    `Done. rows=${result.rowsSynced} ` +
      `pages=${result.pagesFetched} ms=${result.durationMs}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
