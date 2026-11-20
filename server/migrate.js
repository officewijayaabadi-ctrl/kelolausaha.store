import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationsUrl = new URL('./migrations/', import.meta.url);

try {
  const migrationDirectory = fileURLToPath(migrationsUrl);
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort();
  for (const migrationFile of migrationFiles) {
    const migration = await readFile(new URL(migrationFile, migrationsUrl), 'utf8');
    await pool.query(migration);
    console.log(`Database migration applied: ${migrationFile}`);
  }
} finally {
  await pool.end();
}
