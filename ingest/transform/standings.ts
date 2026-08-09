import type { Client } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { readCsv, asInt, asFloat, asBool } from '../csv';
import type { IngestState } from '../state';
import * as schema from '../../src/db/schema';

const CHUNK = 1000;

export async function loadStandings(
  db: LibSQLDatabase<typeof schema>,
  client: Client,
  dumpDir: string,
  state: IngestState,
): Promise<void> {
  const { drivers: driverMap, teams: teamMap, seasons: seasonMap } = state;

  // race_number lookup: jolpica round jolpica_id → race_number (from the DB)
  const rnByRoundFromDb = new Map<number, number>();
  const dbRaces = await db.select({ raceNumber: schema.races.raceNumber, jolpicaId: schema.races.jolpicaId }).from(schema.races);
  for (const r of dbRaces) rnByRoundFromDb.set(r.jolpicaId, r.raceNumber);

  // Resolve team per (race_number, driver_id) — MIN collapses rare shared-drive duplicates
  const teamByEntry = new Map<string, number>();
  const teamsResult = await client.execute(
    'SELECT race_number, driver_id, MIN(team_id) AS team_id FROM round_entries GROUP BY race_number, driver_id'
  );
  for (const row of teamsResult.rows as Record<string, unknown>[]) {
    teamByEntry.set(`${row.race_number}:${row.driver_id}`, row.team_id as number);
  }

  await loadDriverStandings(db, dumpDir, driverMap, rnByRoundFromDb, teamByEntry);
  await loadTeamStandings(db, dumpDir, teamMap, rnByRoundFromDb);
  await loadChampionshipAdjustments(db, dumpDir, driverMap, teamMap, seasonMap);
  await applyHistoricalTeamStandingCorrections(client);
}

/**
 * Jolpica's championship snapshots are final-record data. That means its 2007
 * McLaren rows apply the later season-wide exclusion to every round, even
 * though the decision was issued between the Italian and Belgian Grands Prix.
 *
 * Reconstruct the contemporaneous constructors' table through Italy. The
 * Hungarian GP's separate no-constructor-points penalty remains in effect.
 * From Belgium onward, retain Jolpica's official final-record rows.
 */
async function applyHistoricalTeamStandingCorrections(client: Client): Promise<void> {
  const mclaren = await client.execute(`
    SELECT t.id AS team_id
    FROM championship_adjustments ca
    JOIN teams t ON t.id = ca.team_id
    WHERE ca.season_id = 2007
      AND ca.adjustment = 102
      AND t.slug = 'mclaren'
  `);
  if (mclaren.rows.length !== 1) return;

  const teamId = mclaren.rows[0].team_id as number;

  // McLaren led the provisional constructors' standings after every one of
  // these rounds. Preserve the source's ordering between the other teams.
  await client.execute(`
    UPDATE team_standings
    SET position = position + 1
    WHERE team_id != ${teamId}
      AND position IS NOT NULL
      AND race_number IN (
        SELECT race_number
        FROM races
        WHERE season = 2007 AND round <= 13
      )
  `);

  await client.execute(`
    UPDATE team_standings AS standings
    SET
      points = (
        SELECT COALESCE(SUM(
          CASE WHEN completed.round = 11 THEN 0 ELSE COALESCE(result.points, 0) END
        ), 0)
        FROM race_results result
        JOIN races completed ON completed.race_number = result.race_number
        WHERE result.team_id = ${teamId}
          AND completed.season = 2007
          AND completed.round <= (
            SELECT current.round FROM races current
            WHERE current.race_number = standings.race_number
          )
      ),
      position = 1,
      adjustment_type = 0
    WHERE standings.team_id = ${teamId}
      AND standings.race_number IN (
        SELECT race_number
        FROM races
        WHERE season = 2007 AND round <= 13
      )
  `);
}

async function loadDriverStandings(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
  driverMap: Map<number, number>,
  rnByRound: Map<number, number>,
  teamByEntry: Map<string, number>,
): Promise<void> {
  // Dedup: keep highest session_number per (round_id, driver_id)
  const best = new Map<string, Record<string, string>>();
  for (const r of readCsv(dumpDir, 'formula_one_driverchampionship.csv')) {
    if (!r.round_id) continue;
    const key = `${r.round_id}:${r.driver_id}`;
    const existing = best.get(key);
    const snum = asInt(r, 'session_number') ?? 0;
    if (!existing || snum > (asInt(existing, 'session_number') ?? 0)) {
      best.set(key, r);
    }
  }

  const records: typeof schema.driverStandings.$inferInsert[] = [];
  for (const [, r] of best) {
    const raceNumber = rnByRound.get(parseInt(r.round_id, 10));
    const driverId = driverMap.get(parseInt(r.driver_id, 10));
    if (raceNumber == null || driverId == null) continue;
    records.push({
      raceNumber,
      driverId,
      teamId: teamByEntry.get(`${raceNumber}:${driverId}`) ?? null,
      position: asInt(r, 'position'),
      points: asFloat(r, 'points') ?? 0,
      winCount: asInt(r, 'win_count') ?? 0,
      highestFinish: asInt(r, 'highest_finish'),
      isEligible: asBool(r, 'is_eligible'),
      adjustmentType: asInt(r, 'adjustment_type') ?? 0,
    });
  }
  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.driverStandings).values(records.slice(i, i + CHUNK) as [typeof schema.driverStandings.$inferInsert, ...typeof schema.driverStandings.$inferInsert[]]);
  }
}

async function loadTeamStandings(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
  teamMap: Map<number, number>,
  rnByRound: Map<number, number>,
): Promise<void> {
  const best = new Map<string, Record<string, string>>();
  for (const r of readCsv(dumpDir, 'formula_one_teamchampionship.csv')) {
    if (!r.round_id) continue;
    const key = `${r.round_id}:${r.team_id}`;
    const existing = best.get(key);
    const snum = asInt(r, 'session_number') ?? 0;
    if (!existing || snum > (asInt(existing, 'session_number') ?? 0)) {
      best.set(key, r);
    }
  }

  const records: typeof schema.teamStandings.$inferInsert[] = [];
  for (const [, r] of best) {
    const raceNumber = rnByRound.get(parseInt(r.round_id, 10));
    const teamId = teamMap.get(parseInt(r.team_id, 10));
    if (raceNumber == null || teamId == null) continue;
    records.push({
      raceNumber,
      teamId,
      position: asInt(r, 'position'),
      points: asFloat(r, 'points') ?? 0,
      winCount: asInt(r, 'win_count') ?? 0,
      highestFinish: asInt(r, 'highest_finish'),
      isEligible: asBool(r, 'is_eligible'),
      adjustmentType: asInt(r, 'adjustment_type') ?? 0,
    });
  }
  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.teamStandings).values(records.slice(i, i + CHUNK) as [typeof schema.teamStandings.$inferInsert, ...typeof schema.teamStandings.$inferInsert[]]);
  }
}

async function loadChampionshipAdjustments(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
  driverMap: Map<number, number>,
  teamMap: Map<number, number>,
  seasonMap: Map<number, number>,
): Promise<void> {
  const rows = readCsv(dumpDir, 'formula_one_championshipadjustment.csv');
  if (!rows.length) return;
  const records: typeof schema.championshipAdjustments.$inferInsert[] = rows.map(r => ({
    id: parseInt(r.id, 10),
    jolpicaApiId: r.api_id,
    adjustment: asInt(r, 'adjustment'),
    points: asFloat(r, 'points'),
    driverId: r.driver_id ? driverMap.get(parseInt(r.driver_id, 10)) ?? null : null,
    teamId: r.team_id ? teamMap.get(parseInt(r.team_id, 10)) ?? null : null,
    seasonId: r.season_id ? (seasonMap.get(parseInt(r.season_id, 10)) ?? null) : null,
  }));
  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.championshipAdjustments).values(records.slice(i, i + CHUNK) as [typeof schema.championshipAdjustments.$inferInsert, ...typeof schema.championshipAdjustments.$inferInsert[]]);
  }
}
