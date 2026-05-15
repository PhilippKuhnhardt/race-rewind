import { eq, min, max, count, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { races, raceResults, roundEntries, drivers, teams } from '../../db/schema';

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
  };
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
      primary_color: min(teams.primaryColor),
    })
    .from(roundEntries)
    .innerJoin(drivers, eq(drivers.id, roundEntries.driverId))
    .innerJoin(teams, eq(teams.id, roundEntries.teamId))
    .where(eq(roundEntries.raceNumber, raceNumber))
    .groupBy(drivers.id)
    .orderBy(min(teams.name), min(roundEntries.carNumber));
}
