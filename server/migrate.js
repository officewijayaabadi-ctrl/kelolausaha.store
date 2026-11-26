import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const migrationsUrl = new URL('./migrations/', import.meta.url);

async function main() {
  const migrationDirectory = fileURLToPath(migrationsUrl);
  const migrationFiles = (await readdir(migrationDirectory))
    .filter((name) => /^\d+_.+\.sql$/.test(name))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));

  const prefixes = new Set();
  for (const migrationFile of migrationFiles) {
    const prefix = migrationFile.match(/^(\d+)_/)?.[1];
    prefixes.add(prefix);
  }
  if (prefixes.size !== migrationFiles.length) {
    console.warn('Duplicate migration prefixes detected; files are distinguished by their full filenames.');
  }

  const migrationTable = await pool.query(
    `SELECT to_regclass('public.schema_migrations') AS migration_table`,
  );
  const migrationTableExists = Boolean(migrationTable.rows[0]?.migration_table);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const usersTable = await pool.query(
    `SELECT to_regclass('public.users') AS users_table`,
  );
  const hasExistingDatabase = Boolean(usersTable.rows[0]?.users_table);
  const baselineThrough = process.env.MIGRATION_BASELINE_THROUGH || '';
  if (baselineThrough && !/^\d+$/.test(baselineThrough)) {
    throw new Error('MIGRATION_BASELINE_THROUGH must be a numeric migration prefix.');
  }
  const baselinePrefix = baselineThrough ? Number(baselineThrough) : null;

  if (hasExistingDatabase && !migrationTableExists && baselinePrefix === null) {
    throw new Error(
      'Existing database detected without migration history. Set MIGRATION_BASELINE_THROUGH only after confirming the corresponding migrations were already applied.',
    );
  }

  if (hasExistingDatabase && !migrationTableExists && baselinePrefix !== null) {
    const baselineFiles = migrationFiles.filter((migrationFile) => (
      Number(migrationFile.match(/^(\d+)_/)?.[1]) <= baselinePrefix
    ));
    for (const migrationFile of baselineFiles) {
      await pool.query(
        `INSERT INTO schema_migrations (filename)
         VALUES ($1)
         ON CONFLICT (filename) DO NOTHING`,
        [migrationFile],
      );
    }
    console.log(`Migration baseline recorded through prefix ${String(baselinePrefix).padStart(3, '0')} (${baselineFiles.length} files).`);
  }

  const applied = await pool.query(
    `SELECT filename FROM schema_migrations`,
  );
  const appliedFiles = new Set(applied.rows.map((row) => row.filename));

  for (const migrationFile of migrationFiles) {
    if (appliedFiles.has(migrationFile)) {
      console.log(`Database migration already applied: ${migrationFile}`);
      continue;
    }

    const migration = await readFile(new URL(migrationFile, migrationsUrl), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [migrationFile],
      );
      await client.query('COMMIT');
      console.log(`Database migration applied: ${migrationFile}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

try {
  await main();
} catch (error) {
  console.error('Database migration failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
