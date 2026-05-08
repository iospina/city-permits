// ---------------------------------------------------------------------------
// lib/db.ts
// Thin wrapper around the Neon serverless driver.
//
// We use two interfaces from @neondatabase/serverless:
//   - neon()  — HTTP-fetch tagged-template client. Lowest latency, ideal for
//               read endpoints that issue one query and return.
//   - Pool    — pg-compatible pool over WebSockets, used only by the sync
//               handler because it needs an explicit BEGIN/COMMIT transaction
//               around TRUNCATE + many INSERT batches.
//
// Both read DATABASE_URL from the environment.
// ---------------------------------------------------------------------------

import { neon, Pool } from '@neondatabase/serverless';

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return url;
}

/** Tagged-template HTTP client. Use for one-shot SELECTs in read endpoints. */
export const sql = neon(requireDatabaseUrl());

/**
 * Pool-backed client for transactions. Caller owns connection acquisition,
 * BEGIN/COMMIT/ROLLBACK, and pool.end(). Used by the sync handler only.
 */
export function getPool(): Pool {
  return new Pool({ connectionString: requireDatabaseUrl() });
}
