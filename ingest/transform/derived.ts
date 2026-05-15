import type { Client } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../../src/db/schema';

const CHUNK = 1000;

export async function buildDerived(db: LibSQLDatabase<typeof schema>, client: Client): Promise<void> {
  await buildPrevRaceInSeason(client);
  await buildIsFinalRound(client);
  await buildDriverCareerProgression(db, client);
}

async function buildPrevRaceInSeason(client: Client) {
  await client.execute(`
    UPDATE races
    SET prev_race_in_season = (
      SELECT MAX(r2.race_number)
      FROM races r2
      WHERE r2.season = races.season
        AND r2.race_number < races.race_number
    )
  `);
}

async function buildIsFinalRound(client: Client) {
  await client.execute(`
    UPDATE races
    SET is_final_round = 1
    WHERE race_number IN (
      SELECT MAX(race_number) FROM races GROUP BY season
    )
  `);
}

async function buildDriverCareerProgression(db: LibSQLDatabase<typeof schema>, client: Client) {
  // One row per (driver_id, race_number) via round_entries (covers all participation).
  // Cumulative stats are running totals INCLUDING that race_number.
  // Championships = number of seasons where the driver finished P1 in the final standings,
  // up to and including the given race_number.
  const rows = await client.execute(`WITH
    -- One row per (driver, race) — use DISTINCT to collapse shared-drive round_entry dups
    participation AS (
      SELECT DISTINCT re.driver_id, re.race_number
      FROM round_entries re
    ),
    -- Per-race stats (null → 0)
    per_race AS (
      SELECT
        p.driver_id,
        p.race_number,
        1 AS is_start,
        CASE WHEN rr.position = 1 THEN 1 ELSE 0 END AS is_win,
        CASE WHEN rr.position BETWEEN 1 AND 3 THEN 1 ELSE 0 END AS is_podium,
        CASE WHEN qr.position = 1 THEN 1 ELSE 0 END AS is_pole,
        CASE WHEN rr.fastest_lap_rank = 1 THEN 1 ELSE 0 END AS is_fl,
        COALESCE(rr.points, 0) + COALESCE(sr.points, 0) AS race_pts,
        CASE WHEN ds.position = 1 AND r.is_final_round = 1 THEN 1 ELSE 0 END AS is_champ
      FROM participation p
      JOIN races r ON r.race_number = p.race_number
      LEFT JOIN race_results rr
             ON rr.race_number = p.race_number AND rr.driver_id = p.driver_id
      LEFT JOIN sprint_results sr
             ON sr.race_number = p.race_number AND sr.driver_id = p.driver_id
      LEFT JOIN qualifying_results qr
             ON qr.race_number = p.race_number AND qr.driver_id = p.driver_id
      LEFT JOIN driver_standings ds
             ON ds.race_number = p.race_number AND ds.driver_id = p.driver_id
    )
    SELECT
      driver_id,
      race_number,
      SUM(is_start)  OVER w AS cum_starts,
      SUM(is_win)    OVER w AS cum_wins,
      SUM(is_podium) OVER w AS cum_podiums,
      SUM(is_pole)   OVER w AS cum_poles,
      SUM(is_fl)     OVER w AS cum_fastest_laps,
      SUM(race_pts)  OVER w AS cum_points,
      SUM(is_champ)  OVER w AS cum_championships
    FROM per_race
    WINDOW w AS (PARTITION BY driver_id ORDER BY race_number ROWS UNBOUNDED PRECEDING)
    ORDER BY driver_id, race_number
  `);

  const records: typeof schema.driverCareerProgression.$inferInsert[] = rows.rows.map(row => ({
    driverId: row.driver_id as number,
    raceNumber: row.race_number as number,
    cumStarts: row.cum_starts as number,
    cumWins: row.cum_wins as number,
    cumPodiums: row.cum_podiums as number,
    cumPoles: row.cum_poles as number,
    cumFastestLaps: row.cum_fastest_laps as number,
    cumPoints: row.cum_points as number,
    cumChampionships: row.cum_championships as number,
  }));

  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.driverCareerProgression).values(records.slice(i, i + CHUNK) as [typeof schema.driverCareerProgression.$inferInsert, ...typeof schema.driverCareerProgression.$inferInsert[]]);
  }
}
