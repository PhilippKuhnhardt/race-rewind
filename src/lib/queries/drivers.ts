import { eq, and, lt, min, max } from 'drizzle-orm';
import { db } from '../../db/client';
import { drivers, teams, races, raceResults, roundEntries, driverStandings, driverCareerProgression } from '../../db/schema';
import { stripYearPrefix } from '../format';

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
