import { eq } from 'drizzle-orm';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { openDb, skipIfNoDb, type DbHandle } from './helpers';
import * as schema from '../../src/db/schema';

let handle: DbHandle;

beforeAll(() => {
  const skip = skipIfNoDb();
  if (skip) return;
  handle = openDb();
});

afterAll(() => {
  handle?.client.close();
});

function db() { return handle.db; }
function client() { return handle.client; }

// ---------------------------------------------------------------------------
// Row-count sanity
// ---------------------------------------------------------------------------

const TABLE_MINIMUMS: [string, number][] = [
  ['races',              1000],
  ['drivers',             800],
  ['teams',               200],
  ['circuits',             70],
  ['seasons',              70],
  ['round_entries',     25000],
  ['session_entries',   40000],
  ['race_results',      25000],
  ['qualifying_results',10000],
  ['driver_standings',  20000],
  ['team_standings',     5000],
];

describe('row count minimums', () => {
  for (const [table, minimum] of TABLE_MINIMUMS) {
    it(`${table} >= ${minimum.toLocaleString()}`, async () => {
      const skip = skipIfNoDb();
      if (skip) return;
      const result = await client().execute(`SELECT COUNT(*) AS n FROM ${table}`);
      const n = result.rows[0].n as number;
      expect(n, `${table} has only ${n} rows`).toBeGreaterThanOrEqual(minimum);
    });
  }
});

// ---------------------------------------------------------------------------
// Foreign key integrity
// ---------------------------------------------------------------------------

it('PRAGMA foreign_key_check returns no violations', async () => {
  const skip = skipIfNoDb();
  if (skip) return;
  const result = await client().execute('PRAGMA foreign_key_check');
  expect(result.rows.length, 'FK violations found').toBe(0);
});

// ---------------------------------------------------------------------------
// Slug uniqueness
// ---------------------------------------------------------------------------

describe('slug uniqueness', () => {
  for (const table of ['races', 'drivers', 'teams', 'circuits'] as const) {
    it(`${table}.slug is unique`, async () => {
      const skip = skipIfNoDb();
      if (skip) return;
      const result = await client().execute(
        `SELECT slug, COUNT(*) AS c FROM ${table} GROUP BY slug HAVING c > 1`
      );
      expect(result.rows.length, `Duplicate slugs in ${table}`).toBe(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Standings completeness
// ---------------------------------------------------------------------------

it('every race_results row has a driver_standings row (tolerate <100 Indy 500 edge cases)', async () => {
  const skip = skipIfNoDb();
  if (skip) return;
  const result = await client().execute(`
    SELECT COUNT(*) AS n FROM race_results rr
    WHERE NOT EXISTS (
      SELECT 1 FROM driver_standings ds
      WHERE ds.race_number = rr.race_number AND ds.driver_id = rr.driver_id
    )
  `);
  const missing = result.rows[0].n as number;
  expect(missing, `${missing} race_results rows have no driver_standings`).toBeLessThan(100);
});

// ---------------------------------------------------------------------------
// Spot checks against known historical facts
// ---------------------------------------------------------------------------

it('Schumacher has 32 wins through 1998 Hungarian GP', async () => {
  const skip = skipIfNoDb();
  if (skip) return;
  const race = await db()
    .select({ raceNumber: schema.races.raceNumber })
    .from(schema.races)
    .where(eq(schema.races.slug, '1998-hungarian-grand-prix'))
    .get();
  if (!race) return;

  const driver = await client().execute(
    `SELECT id FROM drivers WHERE slug LIKE 'michael-schumacher%' LIMIT 1`
  );
  if (!driver.rows.length) return;
  const driverId = driver.rows[0].id as number;

  const result = await client().execute(
    `SELECT COUNT(*) AS n FROM race_results WHERE driver_id = ${driverId} AND position = 1 AND race_number <= ${race.raceNumber}`
  );
  expect(result.rows[0].n).toBe(32);
});

it('1986 Hungarian GP has driver_standings rows', async () => {
  const skip = skipIfNoDb();
  if (skip) return;
  const race = await db()
    .select({ raceNumber: schema.races.raceNumber })
    .from(schema.races)
    .where(eq(schema.races.slug, '1986-hungarian-grand-prix'))
    .get();
  if (!race) return;
  const result = await client().execute(
    `SELECT COUNT(*) AS n FROM driver_standings WHERE race_number = ${race.raceNumber}`
  );
  expect(result.rows[0].n as number).toBeGreaterThan(0);
});

it('every race with SR session has has_sprint = 1', async () => {
  const skip = skipIfNoDb();
  if (skip) return;
  const result = await client().execute(`
    SELECT r.slug FROM races r
    WHERE r.has_sprint = 0
      AND EXISTS (
        SELECT 1 FROM sessions s WHERE s.race_number = r.race_number AND s.type = 'SR'
      )
  `);
  expect(result.rows.map(r => r.slug)).toEqual([]);
});

it('race_number density: COUNT >= 0.95 * MAX', async () => {
  const skip = skipIfNoDb();
  if (skip) return;
  const result = await client().execute(
    'SELECT MAX(race_number) AS mx, COUNT(*) AS cnt FROM races'
  );
  const mx = result.rows[0].mx as number;
  const cnt = result.rows[0].cnt as number;
  expect(cnt, `Too many gaps: ${cnt} races but max race_number=${mx}`).toBeGreaterThanOrEqual(mx * 0.95);
});
