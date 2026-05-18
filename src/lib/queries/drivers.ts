import { eq, and, lt, min, max, count, sum, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { drivers, teams, races, raceResults, roundEntries, driverStandings, teamStandings, driverCareerProgression } from '../../db/schema';
import { stripYearPrefix, formatYearRanges } from '../format';

export async function getDriverBySlug(slug: string) {
  const row = await db
    .select({
      id: drivers.id,
      slug: drivers.slug,
      full_name: drivers.fullName,
      nationality: drivers.nationality,
      date_of_birth: drivers.dateOfBirth,
      abbreviation: drivers.abbreviation,
      permanent_car_number: drivers.permanentCarNumber,
    })
    .from(drivers)
    .where(eq(drivers.slug, slug))
    .get();
  return row ?? undefined;
}

export async function getDriverRaceEntry(driverId: number, raceNumber: number) {
  const row = await db
    .select({
      team_name: teams.name,
      grid: raceResults.grid,
      position: raceResults.position,
      points: raceResults.points,
      detail: raceResults.detail,
      is_classified: raceResults.isClassified,
    })
    .from(raceResults)
    .innerJoin(teams, eq(teams.id, raceResults.teamId))
    .where(and(eq(raceResults.driverId, driverId), eq(raceResults.raceNumber, raceNumber)))
    .get();
  return row ?? undefined;
}

export async function getDriverCareerStats(driverId: number, beforeRaceNumber: number) {
  const row = await db
    .select()
    .from(driverCareerProgression)
    .where(and(
      eq(driverCareerProgression.driverId, driverId),
      lt(driverCareerProgression.raceNumber, beforeRaceNumber),
    ))
    .orderBy(driverCareerProgression.raceNumber)
    .all()
    .then(rows => rows.at(-1));

  return {
    starts: row?.cumStarts ?? 0,
    wins: row?.cumWins ?? 0,
    podiums: row?.cumPodiums ?? 0,
    poles: row?.cumPoles ?? 0,
    fastest_laps: row?.cumFastestLaps ?? 0,
    points: row?.cumPoints ?? 0,
    championships: row?.cumChampionships ?? 0,
  };
}

export async function getDriverStandingBeforeRace(driverId: number, raceNumber: number) {
  const prevRaceRow = await db
    .select({ prevRn: races.prevRaceInSeason })
    .from(races)
    .where(eq(races.raceNumber, raceNumber))
    .get();
  if (!prevRaceRow?.prevRn) return undefined;
  const row = await db
    .select({
      position: driverStandings.position,
      points: driverStandings.points,
      win_count: driverStandings.winCount,
    })
    .from(driverStandings)
    .where(and(
      eq(driverStandings.driverId, driverId),
      eq(driverStandings.raceNumber, prevRaceRow.prevRn),
    ))
    .get();
  return row ?? undefined;
}

export interface DriverRacePair {
  driver_slug: string;
  season: number;
  race_slug: string;
}

export async function getAllDriverRacePairs(): Promise<DriverRacePair[]> {
  const rows = await db
    .selectDistinct({
      driver_slug: drivers.slug,
      season: races.season,
      race_slug: races.slug,
    })
    .from(roundEntries)
    .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
    .innerJoin(drivers, eq(drivers.id, roundEntries.driverId))
    .orderBy(races.raceNumber);

  return rows.map((r) => ({
    driver_slug: r.driver_slug,
    season: r.season,
    race_slug: stripYearPrefix(r.race_slug, r.season),
  }));
}

export async function getDriverSeasonFirstRaces(driverId: number): Promise<Record<number, string>> {
  const firstRacesSubq = db
    .select({ season: races.season, firstRn: min(races.raceNumber).as('first_rn') })
    .from(races)
    .innerJoin(roundEntries, and(
      eq(roundEntries.raceNumber, races.raceNumber),
      eq(roundEntries.driverId, driverId),
    ))
    .groupBy(races.season)
    .as('first');

  const rows = await db
    .select({ season: races.season, race_slug: races.slug })
    .from(races)
    .innerJoin(firstRacesSubq, and(
      eq(races.season, firstRacesSubq.season),
      eq(races.raceNumber, firstRacesSubq.firstRn),
    ))
    .orderBy(races.season);

  const result: Record<number, string> = {};
  for (const row of rows) {
    result[row.season] = stripYearPrefix(row.race_slug, row.season);
  }
  return result;
}

export async function getDriverPriorSeasons(driverId: number, beforeRaceNumber: number): Promise<number> {
  const rows = await db
    .selectDistinct({ season: races.season })
    .from(roundEntries)
    .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
    .where(and(eq(roundEntries.driverId, driverId), lt(roundEntries.raceNumber, beforeRaceNumber)));
  return rows.length;
}

export async function getDriverBestChampionshipPos(driverId: number, beforeRaceNumber: number): Promise<number | null> {
  const row = await db
    .select({ pos: min(driverStandings.position) })
    .from(driverStandings)
    .innerJoin(races, and(
      eq(races.raceNumber, driverStandings.raceNumber),
      eq(races.isFinalRound, 1),
    ))
    .where(and(
      eq(driverStandings.driverId, driverId),
      lt(driverStandings.raceNumber, beforeRaceNumber),
    ))
    .get();
  return row?.pos ?? null;
}

export async function getAllDriverCareerStatsAsOf(beforeRaceNumber: number) {
  const latestRnSubq = db
    .select({
      driverId: driverCareerProgression.driverId,
      maxRn: max(driverCareerProgression.raceNumber).as('max_rn'),
    })
    .from(driverCareerProgression)
    .where(lt(driverCareerProgression.raceNumber, beforeRaceNumber))
    .groupBy(driverCareerProgression.driverId)
    .as('latest_rn');

  const [careerRows, seasonDistinctRows, bestChampRows] = await Promise.all([
    db
      .select({
        driver_id: drivers.id,
        driver_slug: drivers.slug,
        full_name: drivers.fullName,
        starts: driverCareerProgression.cumStarts,
        wins: driverCareerProgression.cumWins,
        podiums: driverCareerProgression.cumPodiums,
        points: driverCareerProgression.cumPoints,
        championships: driverCareerProgression.cumChampionships,
      })
      .from(driverCareerProgression)
      .innerJoin(latestRnSubq, and(
        eq(driverCareerProgression.driverId, latestRnSubq.driverId),
        eq(driverCareerProgression.raceNumber, latestRnSubq.maxRn),
      ))
      .innerJoin(drivers, eq(drivers.id, driverCareerProgression.driverId)),

    db
      .selectDistinct({ driverId: roundEntries.driverId, season: races.season })
      .from(roundEntries)
      .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
      .where(lt(roundEntries.raceNumber, beforeRaceNumber)),

    db
      .select({ driverId: driverStandings.driverId, best: min(driverStandings.position) })
      .from(driverStandings)
      .innerJoin(races, and(
        eq(races.raceNumber, driverStandings.raceNumber),
        eq(races.isFinalRound, 1),
      ))
      .where(lt(driverStandings.raceNumber, beforeRaceNumber))
      .groupBy(driverStandings.driverId),
  ]);

  const seasonCountMap = new Map<number, number>();
  for (const row of seasonDistinctRows) {
    seasonCountMap.set(row.driverId, (seasonCountMap.get(row.driverId) ?? 0) + 1);
  }

  const bestChampMap = new Map<number, number | null>();
  for (const row of bestChampRows) {
    bestChampMap.set(row.driverId, row.best);
  }

  const result = careerRows.map((row) => ({
    ...row,
    seasons: seasonCountMap.get(row.driver_id) ?? 0,
    best_championship_pos: bestChampMap.get(row.driver_id) ?? null,
  }));

  result.sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    if (b.points !== a.points) return b.points - a.points;
    if (b.starts !== a.starts) return b.starts - a.starts;
    return a.full_name.localeCompare(b.full_name);
  });

  return result;
}

export interface DriverTeamRecord {
  team_slug: string;
  name: string;
  primary_color: string | null;
  years: string;
  starts: number;
  wins: number;
  points: number;
  driver_championships: number;
  team_championships: number;
}

export async function getDriverTeamsDriven(driverId: number, beforeRaceNumber: number): Promise<DriverTeamRecord[]> {
  const [seasonRows, statsRows, wdcRows, wccRows] = await Promise.all([
    db
      .selectDistinct({
        team_id: teams.id,
        team_slug: teams.slug,
        name: teams.name,
        primary_color: teams.primaryColor,
        season: races.season,
      })
      .from(roundEntries)
      .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
      .innerJoin(teams, eq(teams.id, roundEntries.teamId))
      .where(and(eq(roundEntries.driverId, driverId), lt(roundEntries.raceNumber, beforeRaceNumber))),

    db
      .select({
        team_id: raceResults.teamId,
        starts: count(),
        wins: sql<number>`SUM(CASE WHEN ${raceResults.position} = 1 THEN 1 ELSE 0 END)`,
        points: sum(raceResults.points),
      })
      .from(raceResults)
      .where(and(eq(raceResults.driverId, driverId), lt(raceResults.raceNumber, beforeRaceNumber)))
      .groupBy(raceResults.teamId),

    db
      .select({ season: races.season })
      .from(driverStandings)
      .innerJoin(races, and(eq(races.raceNumber, driverStandings.raceNumber), eq(races.isFinalRound, 1)))
      .where(and(eq(driverStandings.driverId, driverId), eq(driverStandings.position, 1), lt(driverStandings.raceNumber, beforeRaceNumber))),

    db
      .select({ team_id: teamStandings.teamId, season: races.season })
      .from(teamStandings)
      .innerJoin(races, and(eq(races.raceNumber, teamStandings.raceNumber), eq(races.isFinalRound, 1)))
      .where(and(eq(teamStandings.position, 1), lt(teamStandings.raceNumber, beforeRaceNumber))),
  ]);

  const statsMap = new Map<number, { starts: number; wins: number; points: number }>();
  for (const row of statsRows) {
    statsMap.set(row.team_id, { starts: row.starts, wins: Number(row.wins ?? 0), points: Number(row.points ?? 0) });
  }

  const wdcSeasons = new Set(wdcRows.map((r) => r.season));

  const wccPairs = new Set(wccRows.map((r) => `${r.team_id}:${r.season}`));

  const teamMap = new Map<number, { team_slug: string; name: string; primary_color: string | null; seasons: number[] }>();
  for (const row of seasonRows) {
    if (!teamMap.has(row.team_id)) {
      teamMap.set(row.team_id, { team_slug: row.team_slug, name: row.name, primary_color: row.primary_color, seasons: [] });
    }
    teamMap.get(row.team_id)!.seasons.push(row.season);
  }

  return Array.from(teamMap.entries())
    .map(([teamId, { team_slug, name, primary_color, seasons }]) => {
      const stats = statsMap.get(teamId) ?? { starts: 0, wins: 0, points: 0 };
      const driverChamps = seasons.filter((s) => wdcSeasons.has(s)).length;
      const teamChamps = seasons.filter((s) => wccPairs.has(`${teamId}:${s}`)).length;
      return {
        team_slug,
        name,
        primary_color,
        first_season: Math.min(...seasons),
        years: formatYearRanges(seasons),
        starts: stats.starts,
        wins: stats.wins,
        points: stats.points,
        driver_championships: driverChamps,
        team_championships: teamChamps,
      };
    })
    .sort((a, b) => a.first_season - b.first_season || a.name.localeCompare(b.name))
    .map(({ first_season: _fs, ...rest }) => rest);
}
