import { eq, min, max, count, sql, and, lt, asc } from 'drizzle-orm';
import { db } from '../../db/client';
import { races, raceResults, roundEntries, drivers, teams, circuits } from '../../db/schema';
import { stripYearPrefix } from '../format';

export async function getSeasonBookends(season: number) {
  const bounds = await db
    .select({
      first: min(races.raceNumber),
      last: max(races.raceNumber),
      cnt: count(),
    })
    .from(races)
    .where(eq(races.season, season))
    .get();

  const firstRace = await db
    .select({ slug: races.slug, date: races.date })
    .from(races)
    .where(eq(races.raceNumber, bounds!.first!))
    .get();

  const lastRace = await db
    .select({ slug: races.slug, date: races.date })
    .from(races)
    .where(eq(races.raceNumber, bounds!.last!))
    .get();

  const completed = await db
    .select({
      rn: raceResults.raceNumber,
      round: races.round,
      name: races.name,
      date: races.date,
      slug: races.slug,
    })
    .from(raceResults)
    .innerJoin(races, eq(races.raceNumber, raceResults.raceNumber))
    .where(eq(races.season, season))
    .orderBy(sql`${raceResults.raceNumber} DESC`)
    .limit(1)
    .get();

  return {
    firstRaceNumber: bounds!.first!,
    firstSlug: firstRace!.slug,
    firstDate: firstRace!.date,
    lastRaceNumber: bounds!.last!,
    lastSlug: lastRace!.slug,
    lastDate: lastRace!.date,
    raceCount: bounds!.cnt,
    latestCompletedRaceNumber: completed?.rn ?? null,
    latestCompletedRound: completed?.round ?? null,
    latestCompletedName: completed?.name ?? null,
    latestCompletedDate: completed?.date ?? null,
    latestCompletedSlug: completed?.slug ?? null,
  };
}

export interface PoleEntry {
  driver_slug: string;
  driver_surname: string;
}

export interface PodiumEntry {
  position: number;
  driver_slug: string;
  driver_surname: string;
}

export interface SeasonStoryRow {
  round: number;
  race_number: number;
  race_slug: string;
  name: string;
  date: string;
  circuit_name: string;
  circuit_locality: string | null;
  circuit_country: string | null;
  isCompleted: boolean;
  isCurrent: boolean;
  pole: PoleEntry | null;
  podium: PodiumEntry[];
}

export async function getSeasonStoryRows(season: number, asOfRaceNumber: number): Promise<SeasonStoryRow[]> {
  const [calendarRows, podiumRows, poleRows] = await Promise.all([
    db
      .select({
        raceNumber: races.raceNumber,
        round: races.round,
        slug: races.slug,
        name: races.name,
        date: races.date,
        circuit_name: circuits.name,
        circuit_locality: circuits.locality,
        circuit_country: circuits.country,
      })
      .from(races)
      .innerJoin(circuits, eq(circuits.id, races.circuitId))
      .where(eq(races.season, season))
      .orderBy(asc(races.round)),

    db
      .select({
        raceNumber: raceResults.raceNumber,
        position: raceResults.position,
        driver_slug: drivers.slug,
        driver_surname: drivers.surname,
      })
      .from(raceResults)
      .innerJoin(races, eq(races.raceNumber, raceResults.raceNumber))
      .innerJoin(drivers, eq(drivers.id, raceResults.driverId))
      .where(
        and(
          eq(races.season, season),
          lt(raceResults.raceNumber, asOfRaceNumber),
          sql`${raceResults.position} between 1 and 3`,
        ),
      )
      .orderBy(asc(raceResults.raceNumber), sql`${raceResults.position} ASC`),

    db
      .select({
        raceNumber: races.raceNumber,
        driver_slug: drivers.slug,
        driver_surname: drivers.surname,
      })
      .from(races)
      .innerJoin(drivers, eq(drivers.id, races.poleDriverId))
      .where(
        and(
          eq(races.season, season),
          lt(races.raceNumber, asOfRaceNumber),
        ),
      ),
  ]);

  const podiumByRace = new Map<number, PodiumEntry[]>();
  for (const r of podiumRows) {
    if (r.position == null) continue;
    const arr = podiumByRace.get(r.raceNumber) ?? [];
    arr.push({ position: r.position, driver_slug: r.driver_slug, driver_surname: r.driver_surname });
    podiumByRace.set(r.raceNumber, arr);
  }

  const poleByRace = new Map<number, PoleEntry>();
  for (const r of poleRows) {
    poleByRace.set(r.raceNumber, { driver_slug: r.driver_slug, driver_surname: r.driver_surname });
  }

  return calendarRows.map((r) => ({
    round: r.round,
    race_number: r.raceNumber,
    race_slug: stripYearPrefix(r.slug, season),
    name: r.name,
    date: r.date,
    circuit_name: r.circuit_name,
    circuit_locality: r.circuit_locality,
    circuit_country: r.circuit_country,
    isCompleted: r.raceNumber < asOfRaceNumber,
    isCurrent: r.raceNumber === asOfRaceNumber,
    pole: poleByRace.get(r.raceNumber) ?? null,
    podium: podiumByRace.get(r.raceNumber) ?? [],
  }));
}

export async function getRecentFormRows(season: number, asOfRaceNumber: number, limit = 5): Promise<SeasonStoryRow[]> {
  const rows = await getSeasonStoryRows(season, asOfRaceNumber);
  const completed = rows.filter((r) => r.isCompleted);
  return completed.slice(-limit);
}

export async function getSeasonGrid(raceNumber: number) {
  return db
    .select({
      car_number: min(roundEntries.carNumber),
      driver_id: drivers.id,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      date_of_birth: drivers.dateOfBirth,
      team_name: min(teams.name),
      team_slug: min(teams.slug),
      primary_color: min(teams.primaryColor),
    })
    .from(roundEntries)
    .innerJoin(drivers, eq(drivers.id, roundEntries.driverId))
    .innerJoin(teams, eq(teams.id, roundEntries.teamId))
    .where(eq(roundEntries.raceNumber, raceNumber))
    .groupBy(drivers.id)
    .orderBy(min(teams.name), min(roundEntries.carNumber));
}
