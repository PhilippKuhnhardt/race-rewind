/**
 * Entry point: CSV dump → data/f1-history.sqlite
 *
 * Usage:
 *   pnpm ingest
 *   pnpm tsx ingest/build_db.ts --dump ingest/jolpica-dump/2026-04-02 --out data/f1-history.sqlite
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '../src/db/schema';
import { loadReference, loadDimensions } from './transform/dimensions';
import { loadTimeline } from './transform/timeline';
import { loadEntries } from './transform/entries';
import { buildResults } from './transform/results';
import { loadStandings } from './transform/standings';
import { buildDerived } from './transform/derived';

function parseArgs() {
  const args = process.argv.slice(2);
  let dumpDir = 'ingest/jolpica-dump/2026-04-02';
  let outPath = 'data/f1-history.sqlite';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dump' && args[i + 1]) dumpDir = args[++i];
    if (args[i] === '--out' && args[i + 1]) outPath = args[++i];
  }
  return { dumpDir: path.resolve(dumpDir), outPath: path.resolve(outPath) };
}

async function build(dumpDir: string, outPath: string) {
  const t0 = performance.now();

  if (existsSync(outPath)) rmSync(outPath);

  const client = createClient({ url: `file:${outPath}` });
  const db = drizzle(client, { schema });

  // Performance pragmas — must come before schema creation
  await client.execute('PRAGMA journal_mode = OFF');
  await client.execute('PRAGMA synchronous = OFF');
  await client.execute('PRAGMA foreign_keys = ON');

  console.log('Applying schema …');
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });

  console.log('Loading reference tables …');
  await loadReference(db, dumpDir);

  console.log('Loading dimensions (seasons, circuits, drivers, teams) …');
  const state = await loadDimensions(db, dumpDir);

  console.log('Loading timeline (races, sessions) …');
  await loadTimeline(db, dumpDir, state);

  console.log('Loading entries (round_entries, session_entries) …');
  await loadEntries(db, dumpDir, state);

  console.log('Building result tables (race, sprint, qualifying) …');
  await buildResults(db, client, dumpDir);

  console.log('Loading standings snapshots …');
  await loadStandings(db, client, dumpDir, state);

  console.log('Building derived columns and tables …');
  await buildDerived(db, client);

  console.log('Finalizing …');
  await checkIntegrity(db, client);
  await client.execute('VACUUM');
  await client.execute('ANALYZE');
  client.close();

  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  const { size } = await import('node:fs').then(m => ({ size: m.statSync(outPath).size }));
  console.log(`\nDone in ${elapsed}s — ${outPath} (${(size / 1_048_576).toFixed(1)} MB)`);
}

async function checkIntegrity(db: ReturnType<typeof drizzle>, client: ReturnType<typeof createClient>) {
  const violations = await client.execute('PRAGMA foreign_key_check');
  if (violations.rows.length) {
    for (const v of violations.rows) console.error('FK violation:', v);
    throw new Error('Foreign key check failed — aborting.');
  }
  await printRowCounts(client);
}

async function printRowCounts(client: ReturnType<typeof createClient>) {
  const tables = [
    'drivers', 'teams', 'circuits', 'seasons',
    'races', 'sessions',
    'round_entries', 'session_entries',
    'race_results', 'sprint_results', 'qualifying_results', 'sprint_qualifying_results',
    'driver_standings', 'team_standings',
    'driver_career_progression',
  ];
  console.log('\nRow counts:');
  for (const t of tables) {
    const result = await client.execute(`SELECT COUNT(*) AS n FROM ${t}`);
    const n = result.rows[0].n as number;
    console.log(`  ${t.padEnd(32)} ${n.toLocaleString().padStart(10)}`);
  }
}

const { dumpDir, outPath } = parseArgs();
if (!existsSync(dumpDir)) {
  console.error(`Dump directory not found: ${dumpDir}`);
  process.exit(1);
}
build(dumpDir, outPath).catch(err => { console.error(err); process.exit(1); });
