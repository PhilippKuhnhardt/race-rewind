import { eq, and, lt, min, count, sum, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { teams, races, roundEntries, raceResults, teamStandings, teamCareerProgression, driverStandings, drivers } from '../../db/schema';
import { stripYearPrefix, formatYearRanges } from '../format';

export async function getTeamBySlug(slug: string) {
  const row = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      name: teams.name,
      nationality: teams.nationality,
      country_code: teams.countryCode,
      primary_color: teams.primaryColor,
    })
    .from(teams)
    .where(eq(teams.slug, slug))
    .get();
  return row ?? undefined;
}

export interface TeamRacePair {
  team_slug: string;
  season: number;
  race_slug: string;
}

export async function getAllTeamRacePairs(): Promise<TeamRacePair[]> {
  const rows = await db
    .selectDistinct({
      team_slug: teams.slug,
      season: races.season,
      race_slug: races.slug,
    })
    .from(roundEntries)
    .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
    .innerJoin(teams, eq(teams.id, roundEntries.teamId))
    .orderBy(races.raceNumber);

  return rows.map((r) => ({
    team_slug: r.team_slug,
    season: r.season,
    race_slug: stripYearPrefix(r.race_slug, r.season),
  }));
}

export async function getTeamCareerStats(teamId: number, beforeRaceNumber: number) {
  const row = await db
    .select()
    .from(teamCareerProgression)
    .where(and(
      eq(teamCareerProgression.teamId, teamId),
      lt(teamCareerProgression.raceNumber, beforeRaceNumber),
    ))
    .orderBy(teamCareerProgression.raceNumber)
    .all()
    .then(rows => rows.at(-1));

  return {
    entries: row?.cumEntries ?? 0,
    wins: row?.cumWins ?? 0,
    podiums: row?.cumPodiums ?? 0,
    poles: row?.cumPoles ?? 0,
    fastest_laps: row?.cumFastestLaps ?? 0,
    points: row?.cumPoints ?? 0,
    championships: row?.cumChampionships ?? 0,
    drivers_fielded: row?.cumDriversFielded ?? 0,
  };
}

export async function getTeamStandingBeforeRace(teamId: number, raceNumber: number) {
  const prevRaceRow = await db
    .select({ prevRn: races.prevRaceInSeason })
    .from(races)
    .where(eq(races.raceNumber, raceNumber))
    .get();
  if (!prevRaceRow?.prevRn) return undefined;
  const row = await db
    .select({
      position: teamStandings.position,
      points: teamStandings.points,
      win_count: teamStandings.winCount,
    })
    .from(teamStandings)
    .where(and(
      eq(teamStandings.teamId, teamId),
      eq(teamStandings.raceNumber, prevRaceRow.prevRn),
    ))
    .get();
  return row ?? undefined;
}

export async function getTeamSeasonFirstRaces(teamId: number): Promise<Record<number, string>> {
  const firstRacesSubq = db
    .select({ season: races.season, firstRn: min(races.raceNumber).as('first_rn') })
    .from(races)
    .innerJoin(roundEntries, and(
      eq(roundEntries.raceNumber, races.raceNumber),
      eq(roundEntries.teamId, teamId),
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

export interface TeamDriverRecord {
  driver_slug: string;
  full_name: string;
  years: string;
  starts: number;
  wins: number;
  points: number;
  driver_championships: number;
  team_championships: number;
}

export async function getTeamDriversFielded(teamId: number, beforeRaceNumber: number): Promise<TeamDriverRecord[]> {
  const [seasonRows, statsRows, wdcRows, wccRows] = await Promise.all([
    db
      .selectDistinct({
        driver_id: drivers.id,
        driver_slug: drivers.slug,
        full_name: drivers.fullName,
        season: races.season,
      })
      .from(roundEntries)
      .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
      .innerJoin(drivers, eq(drivers.id, roundEntries.driverId))
      .where(and(eq(roundEntries.teamId, teamId), lt(roundEntries.raceNumber, beforeRaceNumber))),

    db
      .select({
        driver_id: raceResults.driverId,
        starts: count(),
        wins: sql<number>`SUM(CASE WHEN ${raceResults.position} = 1 THEN 1 ELSE 0 END)`,
        points: sum(raceResults.points),
      })
      .from(raceResults)
      .where(and(eq(raceResults.teamId, teamId), lt(raceResults.raceNumber, beforeRaceNumber)))
      .groupBy(raceResults.driverId),

    db
      .select({ driver_id: driverStandings.driverId, season: races.season })
      .from(driverStandings)
      .innerJoin(races, and(eq(races.raceNumber, driverStandings.raceNumber), eq(races.isFinalRound, 1)))
      .where(and(eq(driverStandings.position, 1), lt(driverStandings.raceNumber, beforeRaceNumber))),

    db
      .select({ season: races.season })
      .from(teamStandings)
      .innerJoin(races, and(eq(races.raceNumber, teamStandings.raceNumber), eq(races.isFinalRound, 1)))
      .where(and(eq(teamStandings.teamId, teamId), eq(teamStandings.position, 1), lt(teamStandings.raceNumber, beforeRaceNumber))),
  ]);

  const statsMap = new Map<number, { starts: number; wins: number; points: number }>();
  for (const row of statsRows) {
    statsMap.set(row.driver_id, { starts: row.starts, wins: Number(row.wins ?? 0), points: Number(row.points ?? 0) });
  }

  const wdcMap = new Map<number, Set<number>>();
  for (const row of wdcRows) {
    if (!wdcMap.has(row.driver_id)) wdcMap.set(row.driver_id, new Set());
    wdcMap.get(row.driver_id)!.add(row.season);
  }

  const wccSeasons = new Set(wccRows.map((r) => r.season));

  const driverMap = new Map<number, { driver_slug: string; full_name: string; seasons: number[] }>();
  for (const row of seasonRows) {
    if (!driverMap.has(row.driver_id)) {
      driverMap.set(row.driver_id, { driver_slug: row.driver_slug, full_name: row.full_name, seasons: [] });
    }
    driverMap.get(row.driver_id)!.seasons.push(row.season);
  }

  return Array.from(driverMap.entries())
    .map(([driverId, { driver_slug, full_name, seasons }]) => {
      const stats = statsMap.get(driverId) ?? { starts: 0, wins: 0, points: 0 };
      const driverChamps = seasons.filter((s) => wdcMap.get(driverId)?.has(s)).length;
      const teamChamps = seasons.filter((s) => wccSeasons.has(s)).length;
      return {
        driver_slug,
        full_name,
        first_season: Math.min(...seasons),
        years: formatYearRanges(seasons),
        starts: stats.starts,
        wins: stats.wins,
        points: stats.points,
        driver_championships: driverChamps,
        team_championships: teamChamps,
      };
    })
    .sort((a, b) => a.first_season - b.first_season || a.full_name.localeCompare(b.full_name))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ first_season: _, ...rest }) => rest);
}
