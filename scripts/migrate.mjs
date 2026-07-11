// Runs db/schema.sql then db/seed_sources.sql against DATABASE_URL.
// Usage: DATABASE_URL="postgresql://..." node scripts/migrate.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

async function runFile(label, file) {
  const sql = readFileSync(join(root, file), 'utf8');
  await client.query(sql);
  console.log(`✓ ${label} (${file})`);
}

// Files to run: CLI args if given, else the default schema + seed.
const files = process.argv.slice(2);
const plan = files.length
  ? files.map((f) => [f, f])
  : [
      ['schema', 'db/schema.sql'],
      ['seed sources', 'db/seed_sources.sql'],
    ];

try {
  await client.connect();
  console.log('Connected to Postgres.');
  for (const [label, file] of plan) await runFile(label, file);

  const { rows } = await client.query(
    'select tier, count(*)::int as n from sources group by tier order by tier'
  );
  console.log('Sources seeded by tier:', rows);
  const total = await client.query('select count(*)::int as n from sources');
  console.log(`Total sources: ${total.rows[0].n}`);
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  await client.end();
}
