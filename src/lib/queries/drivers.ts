import { eq, and, lt, min, max, count, between, inArray, sql } from 'drizzle-orm';
import { union } from 'drizzle-orm/sqlite-core';
import { db } from '../../db/client';
import { drivers, teams, races, raceResults, sprintResults, sprintQualifyingResults, qualifyingResults, roundEntries, driverStandings } from '../../db/schema';
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

// Derived table: last race_number in each season — used for championship checks
const lastRacePerSeason = db
  .select({ season: races.season, lastRn: max(races.raceNumber).as('last_rn') })
  .from(races)
  .groupBy(races.season)
  .as('last_race_per_season');

export async function getDriverCareerStats(driverId: number, beforeRaceNumber: number) {
  const [
    [startsRow],
    [winsRow],
    [podiumsRow],
    [polesRow],
    [fastestLapsRow],
    [racePointsRow],
    [sprintPointsRow],
    [championshipsRow],
  ] = await Promise.all([
    db.select({ n: count() }).from(roundEntries)
      .where(and(eq(roundEntries.driverId, driverId), lt(roundEntries.raceNumber, beforeRaceNumber))),

    db.select({ n: count() }).from(raceResults)
      .where(and(eq(raceResults.driverId, driverId), lt(raceResults.raceNumber, beforeRaceNumber), eq(raceResults.position, 1))),

    db.select({ n: count() }).from(raceResults)
      .where(and(eq(raceResults.driverId, driverId), lt(raceResults.raceNumber, beforeRaceNumber), between(raceResults.position, 1, 3))),

    db.select({ n: count() }).from(qualifyingResults)
      .where(and(eq(qualifyingResults.driverId, driverId), lt(qualifyingResults.raceNumber, beforeRaceNumber), eq(qualifyingResults.position, 1))),

    db.select({ n: count() }).from(raceResults)
      .where(and(eq(raceResults.driverId, driverId), lt(raceResults.raceNumber, beforeRaceNumber), eq(raceResults.fastestLapRank, 1))),

    db.select({ n: sql<number>`COALESCE(SUM(${raceResults.points}), 0)` }).from(raceResults)
      .where(and(eq(raceResults.driverId, driverId), lt(raceResults.raceNumber, beforeRaceNumber))),

    db.select({ n: sql<number>`COALESCE(SUM(${sprintResults.points}), 0)` }).from(sprintResults)
      .where(and(eq(sprintResults.driverId, driverId), lt(sprintResults.raceNumber, beforeRaceNumber))),

    db.select({ n: count() }).from(driverStandings)
      .innerJoin(lastRacePerSeason, eq(lastRacePerSeason.lastRn, driverStandings.raceNumber))
      .where(and(
        eq(driverStandings.driverId, driverId),
        eq(driverStandings.position, 1),
        lt(driverStandings.raceNumber, beforeRaceNumber),
      )),
  ]);

  return {
    starts: startsRow.n,
    wins: winsRow.n,
    podiums: podiumsRow.n,
    poles: polesRow.n,
    fastest_laps: fastestLapsRow.n,
    points: racePointsRow.n + sprintPointsRow.n,
    championships: championshipsRow.n,
  };
}

export async function getDriverStandingBeforeRace(driverId: number, raceNumber: number, season: number) {
  const row = await db
    .select({
      position: driverStandings.position,
      points: driverStandings.points,
      win_count: driverStandings.winCount,
    })
    .from(driverStandings)
    .where(and(
      eq(driverStandings.driverId, driverId),
      sql`${driverStandings.raceNumber} = (SELECT MAX(r.race_number) FROM races r WHERE r.season = ${season} AND r.race_number < ${raceNumber})`,
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
  const pairs = union(
    db.select({ driverId: roundEntries.driverId, raceNumber: roundEntries.raceNumber }).from(roundEntries),
    db.select({ driverId: qualifyingResults.driverId, raceNumber: qualifyingResults.raceNumber }).from(qualifyingResults),
    db.select({ driverId: raceResults.driverId, raceNumber: raceResults.raceNumber }).from(raceResults),
    db.select({ driverId: sprintQualifyingResults.driverId, raceNumber: sprintQualifyingResults.raceNumber }).from(sprintQualifyingResults),
    db.select({ driverId: sprintResults.driverId, raceNumber: sprintResults.raceNumber }).from(sprintResults),
    db.select({ driverId: driverStandings.driverId, raceNumber: driverStandings.raceNumber }).from(driverStandings),
  ).as('driver_race_pairs');

  const rows = await db
    .selectDistinct({
      driver_slug: drivers.slug,
      season: races.season,
      race_slug: races.slug,
    })
    .from(races)
    .innerJoin(pairs, eq(pairs.raceNumber, races.raceNumber))
    .innerJoin(drivers, eq(drivers.id, pairs.driverId))
    .orderBy(races.raceNumber);

  return rows.map((r) => ({
    driver_slug: r.driver_slug,
    season: r.season,
    race_slug: stripYearPrefix(r.race_slug, r.season),
  }));
}

export async function getDriverSeasonFirstRaces(driverId: number): Promise<Record<number, string>> {
  const driverRaceNumbers = union(
    db.select({ raceNumber: roundEntries.raceNumber }).from(roundEntries).where(eq(roundEntries.driverId, driverId)),
    db.select({ raceNumber: driverStandings.raceNumber }).from(driverStandings).where(eq(driverStandings.driverId, driverId)),
  );

  const firstRacesSubq = db
    .select({ season: races.season, firstRn: min(races.raceNumber).as('first_rn') })
    .from(races)
    .where(inArray(races.raceNumber, driverRaceNumbers))
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
    .innerJoin(lastRacePerSeason, eq(lastRacePerSeason.lastRn, driverStandings.raceNumber))
    .where(and(
      eq(driverStandings.driverId, driverId),
      lt(driverStandings.raceNumber, beforeRaceNumber),
    ))
    .get();
  return row?.pos ?? null;
}
