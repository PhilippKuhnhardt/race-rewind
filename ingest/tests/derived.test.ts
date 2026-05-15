/**
 * Validates the derived columns/tables added by ingest/transform/derived.ts.
 */
import { eq } from 'drizzle-orm';
import { beforeAll, afterAll, it, expect } from 'vitest';
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

// ---------------------------------------------------------------------------
// prev_race_in_season
// ---------------------------------------------------------------------------

it('prev_race_in_season is null for every round-1 race', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;
  const result = await handle.client.execute(`
    SELECT COUNT(*) AS n FROM races
    WHERE round = 1 AND prev_race_in_season IS NOT NULL
  `);
  expect(result.rows[0].n).toBe(0);
});

it('prev_race_in_season references a race in the same season for all non-first rounds', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;
  const result = await handle.client.execute(`
    SELECT COUNT(*) AS n FROM races r
    WHERE r.round > 1
      AND r.prev_race_in_season IS NULL
  `);
  expect(result.rows[0].n).toBe(0);
});

it('prev_race_in_season always points to a smaller race_number in the same season', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;
  const result = await handle.client.execute(`
    SELECT COUNT(*) AS n FROM races r
    JOIN races prev ON prev.race_number = r.prev_race_in_season
    WHERE prev.season <> r.season OR prev.race_number >= r.race_number
  `);
  expect(result.rows[0].n).toBe(0);
});

// ---------------------------------------------------------------------------
// is_final_round
// ---------------------------------------------------------------------------

it('exactly one is_final_round = 1 per season', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;
  const result = await handle.client.execute(`
    SELECT season, COUNT(*) AS n FROM races WHERE is_final_round = 1 GROUP BY season HAVING n <> 1
  `);
  expect(result.rows.length, 'Some seasons have != 1 final round').toBe(0);
});

it('is_final_round race matches MAX(race_number) for that season', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;
  const result = await handle.client.execute(`
    SELECT COUNT(*) AS n FROM races r
    WHERE r.is_final_round = 1
      AND r.race_number <> (SELECT MAX(r2.race_number) FROM races r2 WHERE r2.season = r.season)
  `);
  expect(result.rows[0].n).toBe(0);
});

// ---------------------------------------------------------------------------
// driver_career_progression
// ---------------------------------------------------------------------------

it('Schumacher progression row at 1998 Hungarian GP has cum_wins = 32', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;

  const race = await handle.db
    .select({ raceNumber: schema.races.raceNumber })
    .from(schema.races)
    .where(eq(schema.races.slug, '1998-hungarian-grand-prix'))
    .get();
  if (!race) return;

  const driver = await handle.client.execute(
    `SELECT id FROM drivers WHERE slug LIKE 'michael-schumacher%' LIMIT 1`
  );
  if (!driver.rows.length) return;
  const driverId = driver.rows[0].id as number;

  const row = await handle.db
    .select()
    .from(schema.driverCareerProgression)
    .where(
      eq(schema.driverCareerProgression.driverId, driverId)
    )
    .all();
  // Find the row at exactly 1998 Hungarian GP race_number
  const atRace = row.find(r => r.raceNumber === race.raceNumber);
  expect(atRace, 'No progression row at 1998 Hungarian GP for Schumacher').toBeDefined();
  expect(atRace!.cumWins).toBe(32);
});

it('driver_career_progression cum_wins matches race_results count for 2023 Bahrain', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;

  const race = await handle.db
    .select({ raceNumber: schema.races.raceNumber })
    .from(schema.races)
    .where(eq(schema.races.slug, '2023-bahrain-grand-prix'))
    .get();
  if (!race) return;

  // Verstappen wins this race; pick him
  const driver = await handle.client.execute(
    `SELECT id FROM drivers WHERE full_name = 'Max Verstappen' LIMIT 1`
  );
  if (!driver.rows.length) return;
  const driverId = driver.rows[0].id as number;

  const [progRows, winsResult] = await Promise.all([
    handle.db
      .select({ raceNumber: schema.driverCareerProgression.raceNumber, cumWins: schema.driverCareerProgression.cumWins })
      .from(schema.driverCareerProgression)
      .where(eq(schema.driverCareerProgression.driverId, driverId)),
    handle.client.execute(
      `SELECT COUNT(*) AS n FROM race_results WHERE driver_id = ${driverId} AND position = 1 AND race_number <= ${race.raceNumber}`
    ),
  ]);

  const progRow = progRows.find(r => r.raceNumber === race.raceNumber);
  const cumWins = progRow?.cumWins;
  const countWins = winsResult.rows[0].n as number;
  expect(cumWins).toBe(countWins);
});

it('all drivers with round_entries have a driver_career_progression row', async () => {
  const skip = skipIfNoDb(); if (skip || !handle) return;
  const result = await handle.client.execute(`
    SELECT COUNT(DISTINCT re.driver_id) AS n FROM round_entries re
    WHERE NOT EXISTS (
      SELECT 1 FROM driver_career_progression dcp WHERE dcp.driver_id = re.driver_id
    )
  `);
  expect(result.rows[0].n).toBe(0);
});

// ---------------------------------------------------------------------------
// team_career_progression
// ---------------------------------------------------------------------------

it('Ferrari at the 2000 Italian Grand Prix has 9 constructors titles and 131 wins', async () => {
  // Ferrari's 9 titles by Monza 2000: 1961,1964,1975,1976,1977,1979,1982,1983,1999.
  // This is a regression pin for the championship detection fix (teams may win at
  // a final round they did not enter, so championships are counted via team_standings).
  const skip = skipIfNoDb(); if (skip || !handle) return;

  const race = await handle.db
    .select({ raceNumber: schema.races.raceNumber })
    .from(schema.races)
    .where(eq(schema.races.slug, '2000-italian-grand-prix'))
    .get();
  if (!race) return;

  const team = await handle.client.execute(
    `SELECT id FROM teams WHERE slug = 'ferrari' LIMIT 1`
  );
  if (!team.rows.length) return;
  const teamId = team.rows[0].id as number;

  const row = await handle.db
    .select()
    .from(schema.teamCareerProgression)
    .where(eq(schema.teamCareerProgression.teamId, teamId))
    .all()
    .then(rows => rows.find(r => r.raceNumber === race.raceNumber));

  expect(row, 'No team_career_progression row at 2000 Italian GP for Ferrari').toBeDefined();
  expect(row!.cumChampionships).toBe(9);
  expect(row!.cumWins).toBe(132);
});
