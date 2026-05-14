import { queryAll, queryOne } from './db';
import { stripYearPrefix } from './format';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Race {
  race_number: number;
  slug: string;
  season: number;
  round: number;
  name: string;
  date: string;
  has_sprint: number;
  circuit_name: string;
  circuit_locality: string;
  circuit_country: string;
}

export interface QualifyingRow {
  position: number | null;
  driver_id: number;
  driver_slug: string;
  full_name: string;
  team_name: string;
  q1_time: string | null;
  q2_time: string | null;
  q3_time: string | null;
  qualifying_time: string | null;
  knocked_out_in: string | null;
}

export interface SprintQualiRow {
  position: number | null;
  driver_id: number;
  driver_slug: string;
  full_name: string;
  team_name: string;
  sq1_time: string | null;
  sq2_time: string | null;
  sq3_time: string | null;
  knocked_out_in: string | null;
}

export interface RaceResultRow {
  position: number | null;
  driver_id: number;
  driver_slug: string;
  full_name: string;
  team_name: string;
  car_number: number | null;
  grid: number | null;
  laps_completed: number | null;
  time: string | null;
  detail: string | null;
  points: number | null;
  is_classified: number;
  fastest_lap_rank: number | null;
  pit_stop_count: number | null;
}

export interface DriverStandingRow {
  driver_id: number;
  driver_slug: string;
  full_name: string;
  team_name: string;
  position: number | null;
  points: number;
  win_count: number;
}

export interface TeamStandingRow {
  team_id: number;
  team_name: string;
  position: number | null;
  points: number;
  win_count: number;
}

// ---------------------------------------------------------------------------
// getStaticPaths helpers
// ---------------------------------------------------------------------------

export interface RaceNavEntry {
  slug: string; // URL segment (without year prefix)
  name: string;
}

/** Returns all seasons and their races for the nav selector, ordered chronologically. */
export function getAllRacesBySeason(): {
  seasons: number[];
  byseason: Record<number, RaceNavEntry[]>;
} {
  const rows = queryAll<{ season: number; slug: string; name: string }>(
    `SELECT season, slug, name FROM races ORDER BY race_number`
  );

  const byseason: Record<number, RaceNavEntry[]> = {};
  for (const r of rows) {
    const entry: RaceNavEntry = { slug: stripYearPrefix(r.slug, r.season), name: r.name };
    if (!byseason[r.season]) byseason[r.season] = [];
    byseason[r.season].push(entry);
  }
  const seasons = Object.keys(byseason).map(Number);
  return { seasons, byseason };
}

export function getAllRaces(): { season: number; race_slug: string }[] {
  return queryAll<{ season: number; slug: string }>(
    `SELECT season, slug FROM races ORDER BY race_number`
  ).map((r) => ({ season: r.season, race_slug: stripYearPrefix(r.slug, r.season) }));
}

// ---------------------------------------------------------------------------
// Single race lookup
// ---------------------------------------------------------------------------

export function getRaceBySlug(slug: string): Race | undefined {
  return queryOne<Race>(
    `SELECT r.race_number, r.slug, r.season, r.round, r.name, r.date, r.has_sprint,
            c.name AS circuit_name, c.locality AS circuit_locality, c.country AS circuit_country
     FROM races r
     JOIN circuits c ON c.id = r.circuit_id
     WHERE r.slug = ?`,
    slug
  );
}

// ---------------------------------------------------------------------------
// Session result queries — all return rows ordered by position ASC NULLS LAST
// ---------------------------------------------------------------------------

export function getQualifyingResults(raceNumber: number): QualifyingRow[] {
  return queryAll<QualifyingRow>(
    `SELECT qr.position,
            qr.driver_id,
            d.slug AS driver_slug,
            d.full_name,
            t.name AS team_name,
            qr.q1_time,
            qr.q2_time,
            qr.q3_time,
            qr.qualifying_time,
            qr.knocked_out_in
     FROM qualifying_results qr
     JOIN drivers d ON d.id = qr.driver_id
     JOIN teams   t ON t.id = qr.team_id
     WHERE qr.race_number = ?
     ORDER BY qr.position ASC NULLS LAST`,
    raceNumber
  );
}

export function getSprintQualifyingResults(raceNumber: number): SprintQualiRow[] {
  return queryAll<SprintQualiRow>(
    `SELECT sqr.position,
            sqr.driver_id,
            d.slug AS driver_slug,
            d.full_name,
            t.name AS team_name,
            sqr.sq1_time,
            sqr.sq2_time,
            sqr.sq3_time,
            sqr.knocked_out_in
     FROM sprint_qualifying_results sqr
     JOIN drivers d ON d.id = sqr.driver_id
     JOIN teams   t ON t.id = sqr.team_id
     WHERE sqr.race_number = ?
     ORDER BY sqr.position ASC NULLS LAST`,
    raceNumber
  );
}

function fetchResults(
  table: 'race_results' | 'sprint_results',
  raceNumber: number
): RaceResultRow[] {
  return queryAll<RaceResultRow>(
    `SELECT r.position, r.driver_id, d.slug AS driver_slug, d.full_name,
            t.name AS team_name, r.car_number, r.grid, r.laps_completed,
            r.time, r.detail, r.points, r.is_classified, r.fastest_lap_rank, r.pit_stop_count
     FROM ${table} r
     JOIN drivers d ON d.id = r.driver_id
     JOIN teams   t ON t.id = r.team_id
     WHERE r.race_number = ?
     ORDER BY r.position ASC NULLS LAST`,
    raceNumber
  );
}

export const getRaceResults = (n: number) => fetchResults('race_results', n);
export const getSprintResults = (n: number) => fetchResults('sprint_results', n);

// ---------------------------------------------------------------------------
// Championship tables (section 6)
// ---------------------------------------------------------------------------

export function getDriverStandings(raceNumber: number): DriverStandingRow[] {
  return queryAll<DriverStandingRow>(
    `SELECT ds.driver_id,
            d.slug AS driver_slug,
            d.full_name,
            t.name AS team_name,
            ds.position,
            ds.points,
            ds.win_count
     FROM driver_standings ds
     JOIN drivers d ON d.id = ds.driver_id
     LEFT JOIN teams t ON t.id = ds.team_id
     WHERE ds.race_number = ?
     ORDER BY ds.position ASC NULLS LAST`,
    raceNumber
  );
}

export function getTeamStandings(raceNumber: number): TeamStandingRow[] {
  return queryAll<TeamStandingRow>(
    `SELECT ts.team_id,
            t.name AS team_name,
            ts.position,
            ts.points,
            ts.win_count
     FROM team_standings ts
     JOIN teams t ON t.id = ts.team_id
     WHERE ts.race_number = ?
     ORDER BY ts.position ASC NULLS LAST`,
    raceNumber
  );
}

// ---------------------------------------------------------------------------
// Latest race (used as nav default when no race context is supplied)
// ---------------------------------------------------------------------------

export interface LatestRace {
  season: number;
  slug: string;
}

export function getLatestRace(): LatestRace {
  return queryOne<LatestRace>(
    `SELECT season, slug FROM races ORDER BY race_number DESC LIMIT 1`
  ) as LatestRace;
}

// ---------------------------------------------------------------------------
// Driver time-travel page helpers
// ---------------------------------------------------------------------------

export interface Driver {
  id: number;
  slug: string;
  full_name: string;
  nationality: string | null;
  date_of_birth: string | null;
  abbreviation: string | null;
  permanent_car_number: number | null;
}

export function getDriverBySlug(slug: string): Driver | undefined {
  return queryOne<Driver>(
    `SELECT id, slug, full_name, nationality, date_of_birth, abbreviation, permanent_car_number
     FROM drivers WHERE slug = ?`,
    slug
  );
}

export interface DriverRaceEntry {
  team_name: string;
  grid: number | null;
  position: number | null;
  points: number | null;
  detail: string | null;
  is_classified: number;
}

export function getDriverRaceEntry(
  driverId: number,
  raceNumber: number
): DriverRaceEntry | undefined {
  return queryOne<DriverRaceEntry>(
    `SELECT t.name AS team_name, rr.grid, rr.position, rr.points, rr.detail, rr.is_classified
     FROM race_results rr
     JOIN teams t ON t.id = rr.team_id
     WHERE rr.driver_id = ? AND rr.race_number = ?`,
    driverId,
    raceNumber
  );
}

export interface DriverCareerStats {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastest_laps: number;
  points: number;
  championships: number;
}

/** Returns career stats strictly BEFORE beforeRaceNumber (i.e. the given race is not counted). */
export function getDriverCareerStats(
  driverId: number,
  beforeRaceNumber: number
): DriverCareerStats {
  const n = (sql: string) => queryOne<{ n: number }>(sql, driverId, beforeRaceNumber)!.n;

  const starts = n(
    `SELECT COUNT(*) AS n FROM round_entries WHERE driver_id = ? AND race_number < ?`
  );
  const wins = n(
    `SELECT COUNT(*) AS n FROM race_results WHERE driver_id = ? AND position = 1 AND race_number < ?`
  );
  const podiums = n(
    `SELECT COUNT(*) AS n FROM race_results WHERE driver_id = ? AND position BETWEEN 1 AND 3 AND race_number < ?`
  );
  const poles = n(
    `SELECT COUNT(*) AS n FROM qualifying_results WHERE driver_id = ? AND position = 1 AND race_number < ?`
  );
  const fastest_laps = n(
    `SELECT COUNT(*) AS n FROM race_results WHERE driver_id = ? AND fastest_lap_rank = 1 AND race_number < ?`
  );
  const racePoints = n(
    `SELECT COALESCE(SUM(points), 0) AS n FROM race_results WHERE driver_id = ? AND race_number < ?`
  );
  const sprintPoints = n(
    `SELECT COALESCE(SUM(points), 0) AS n FROM sprint_results WHERE driver_id = ? AND race_number < ?`
  );

  const championships = queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM driver_standings ds
     JOIN races r ON r.race_number = ds.race_number
     WHERE ds.driver_id = ?
       AND ds.position = 1
       AND ds.race_number < ?
       AND ds.race_number = (
         SELECT MAX(race_number) FROM races WHERE season = r.season
       )`,
    driverId,
    beforeRaceNumber
  )!.n;

  return {
    starts,
    wins,
    podiums,
    poles,
    fastest_laps,
    points: racePoints + sprintPoints,
    championships,
  };
}

export interface DriverSeasonStanding {
  position: number | null;
  points: number;
  win_count: number;
}

/** Standing for a single driver going INTO the given race (i.e. after the previous race of the same season). */
export function getDriverStandingBeforeRace(
  driverId: number,
  raceNumber: number,
  season: number
): DriverSeasonStanding | undefined {
  return queryOne<DriverSeasonStanding>(
    `SELECT position, points, win_count
     FROM driver_standings
     WHERE driver_id = ?
       AND race_number = (
         SELECT MAX(r.race_number)
         FROM races r
         WHERE r.season = ? AND r.race_number < ?
       )`,
    driverId,
    season,
    raceNumber
  );
}

/** Full drivers' championship table going INTO the given race (after the previous race of the same season). */
export function getDriverStandingsBeforeRace(
  raceNumber: number,
  season: number
): DriverStandingRow[] {
  return queryAll<DriverStandingRow>(
    `SELECT ds.driver_id,
            d.slug AS driver_slug,
            d.full_name,
            t.name AS team_name,
            ds.position,
            ds.points,
            ds.win_count
     FROM driver_standings ds
     JOIN drivers d ON d.id = ds.driver_id
     LEFT JOIN teams t ON t.id = ds.team_id
     WHERE ds.race_number = (
       SELECT MAX(r.race_number)
       FROM races r
       WHERE r.season = ? AND r.race_number < ?
     )
     ORDER BY ds.position ASC NULLS LAST`,
    season,
    raceNumber
  );
}

/** Full constructors' championship table going INTO the given race (after the previous race of the same season). */
export function getTeamStandingsBeforeRace(raceNumber: number, season: number): TeamStandingRow[] {
  return queryAll<TeamStandingRow>(
    `SELECT ts.team_id,
            t.name AS team_name,
            ts.position,
            ts.points,
            ts.win_count
     FROM team_standings ts
     JOIN teams t ON t.id = ts.team_id
     WHERE ts.race_number = (
       SELECT MAX(r.race_number)
       FROM races r
       WHERE r.season = ? AND r.race_number < ?
     )
     ORDER BY ts.position ASC NULLS LAST`,
    season,
    raceNumber
  );
}

export interface DriverRacePair {
  driver_slug: string;
  season: number;
  race_slug: string; // stripped (no year prefix)
}

export function getAllDriverRacePairs(): DriverRacePair[] {
  const rows = queryAll<{ driver_slug: string; season: number; race_slug: string }>(
    `SELECT DISTINCT d.slug AS driver_slug, r.season, r.slug AS race_slug
     FROM races r
     JOIN (
       SELECT driver_id, race_number FROM round_entries
       UNION SELECT driver_id, race_number FROM qualifying_results
       UNION SELECT driver_id, race_number FROM race_results
       UNION SELECT driver_id, race_number FROM sprint_qualifying_results
       UNION SELECT driver_id, race_number FROM sprint_results
       UNION SELECT driver_id, race_number FROM driver_standings
     ) x ON x.race_number = r.race_number
     JOIN drivers d ON d.id = x.driver_id
     ORDER BY r.race_number`
  );
  return rows.map((r) => ({
    driver_slug: r.driver_slug,
    season: r.season,
    race_slug: stripYearPrefix(r.race_slug, r.season),
  }));
}

/** Maps season → first race slug (stripped) for the seasons a driver has pages in. Used by nav fallback. */
export function getDriverSeasonFirstRaces(driverId: number): Record<number, string> {
  const rows = queryAll<{ season: number; race_slug: string }>(
    `SELECT r.season, r.slug AS race_slug
     FROM races r
     INNER JOIN (
       SELECT r2.season, MIN(r2.race_number) AS first_rn
       FROM races r2
       WHERE r2.race_number IN (
         SELECT race_number FROM round_entries WHERE driver_id = ?
         UNION SELECT race_number FROM driver_standings WHERE driver_id = ?
       )
       GROUP BY r2.season
     ) first ON r.season = first.season AND r.race_number = first.first_rn
     ORDER BY r.season`,
    driverId,
    driverId
  );
  const result: Record<number, string> = {};
  for (const row of rows) {
    result[row.season] = stripYearPrefix(row.race_slug, row.season);
  }
  return result;
}
