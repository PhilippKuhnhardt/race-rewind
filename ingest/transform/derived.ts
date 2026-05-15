import type { Client } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../../src/db/schema';

const CHUNK = 1000;

export async function buildDerived(db: LibSQLDatabase<typeof schema>, client: Client): Promise<void> {
  await buildPrevRaceInSeason(client);
  await buildIsFinalRound(client);
  await buildDriverCareerProgression(db, client);
  await buildTeamCareerProgression(db, client);
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

async function buildTeamCareerProgression(db: LibSQLDatabase<typeof schema>, client: Client) {
  const rows = await client.execute(`WITH
    participation AS (
      SELECT DISTINCT team_id, race_number
      FROM round_entries
    ),
    driver_debuts AS (
      SELECT team_id, driver_id, MIN(race_number) AS debut_race
      FROM round_entries
      GROUP BY team_id, driver_id
    ),
    per_race AS (
      SELECT
        p.team_id,
        p.race_number,
        1 AS is_entry,
        CASE WHEN EXISTS (
          SELECT 1 FROM race_results rr
          WHERE rr.race_number = p.race_number AND rr.team_id = p.team_id AND rr.position = 1
        ) THEN 1 ELSE 0 END AS is_win,
        CASE WHEN EXISTS (
          SELECT 1 FROM race_results rr
          WHERE rr.race_number = p.race_number AND rr.team_id = p.team_id AND rr.position BETWEEN 1 AND 3
        ) THEN 1 ELSE 0 END AS is_podium,
        CASE WHEN EXISTS (
          SELECT 1 FROM qualifying_results qr
          WHERE qr.race_number = p.race_number AND qr.team_id = p.team_id AND qr.position = 1
        ) THEN 1 ELSE 0 END AS is_pole,
        CASE WHEN EXISTS (
          SELECT 1 FROM race_results rr
          WHERE rr.race_number = p.race_number AND rr.team_id = p.team_id AND rr.fastest_lap_rank = 1
        ) THEN 1 ELSE 0 END AS is_fl,
        COALESCE((
          SELECT SUM(rr.points) FROM race_results rr
          WHERE rr.race_number = p.race_number AND rr.team_id = p.team_id
        ), 0) + COALESCE((
          SELECT SUM(sr.points) FROM sprint_results sr
          WHERE sr.race_number = p.race_number AND sr.team_id = p.team_id
        ), 0) AS race_pts,
        (
          SELECT COUNT(*) FROM driver_debuts dd
          WHERE dd.team_id = p.team_id AND dd.debut_race = p.race_number
        ) AS new_drivers
      FROM participation p
    ),
    -- Championship-winning final rounds from team_standings (independent of participation).
    -- A team may win the title at a race they did not enter (e.g. Ferrari 1961 US GP).
    champ_races AS (
      SELECT ts.team_id, r.race_number
      FROM team_standings ts
      JOIN races r ON r.race_number = ts.race_number
      WHERE ts.position = 1 AND r.is_final_round = 1
    ),
    windowed AS (
      SELECT
        team_id,
        race_number,
        SUM(is_entry)    OVER w AS cum_entries,
        SUM(is_win)      OVER w AS cum_wins,
        SUM(is_podium)   OVER w AS cum_podiums,
        SUM(is_pole)     OVER w AS cum_poles,
        SUM(is_fl)       OVER w AS cum_fastest_laps,
        SUM(race_pts)    OVER w AS cum_points,
        SUM(new_drivers) OVER w AS cum_drivers_fielded
      FROM per_race
      WINDOW w AS (PARTITION BY team_id ORDER BY race_number ROWS UNBOUNDED PRECEDING)
    )
    SELECT
      w.team_id,
      w.race_number,
      w.cum_entries,
      w.cum_wins,
      w.cum_podiums,
      w.cum_poles,
      w.cum_fastest_laps,
      w.cum_points,
      (
        SELECT COUNT(*) FROM champ_races cr
        WHERE cr.team_id = w.team_id AND cr.race_number <= w.race_number
      ) AS cum_championships,
      w.cum_drivers_fielded
    FROM windowed w
    ORDER BY w.team_id, w.race_number
  `);

  const records: typeof schema.teamCareerProgression.$inferInsert[] = rows.rows.map(row => ({
    teamId: row.team_id as number,
    raceNumber: row.race_number as number,
    cumEntries: row.cum_entries as number,
    cumWins: row.cum_wins as number,
    cumPodiums: row.cum_podiums as number,
    cumPoles: row.cum_poles as number,
    cumFastestLaps: row.cum_fastest_laps as number,
    cumPoints: row.cum_points as number,
    cumChampionships: row.cum_championships as number,
    cumDriversFielded: row.cum_drivers_fielded as number,
  }));

  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.teamCareerProgression).values(records.slice(i, i + CHUNK) as [typeof schema.teamCareerProgression.$inferInsert, ...typeof schema.teamCareerProgression.$inferInsert[]]);
  }
}
