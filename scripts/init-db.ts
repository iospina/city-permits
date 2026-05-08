// ---------------------------------------------------------------------------
// scripts/init-db.ts
// Apply db/schema.sql to the database referenced by DATABASE_URL.
//
// Run with:
//   npm run db:init   (requires .env.local with DATABASE_URL)
//
// Idempotent — every CREATE in schema.sql is `IF NOT EXISTS`.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Pool } from '@neondatabase/serverless';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '..', 'db', 'schema.sql');

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add it to .env.local.');
  }

  const sql = readFileSync(SCHEMA_PATH, 'utf-8');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query(sql);
    console.info('Schema applied.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
