import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationUrl = new URL('./migrations/001_billing.sql', import.meta.url);

try {
  const migration = await readFile(fileURLToPath(migrationUrl), 'utf8');
  await pool.query(migration);
  console.log('Database migration applied.');
} finally {
  await pool.end();
}
