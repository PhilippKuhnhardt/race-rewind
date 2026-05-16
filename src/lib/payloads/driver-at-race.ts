import { db } from '../../db/client';
import { roundEntries, raceResults, teams } from '../../db/schema';
import { and, eq } from 'drizzle-orm';
import {
  getDriverBySlug,
  getRaceBySlug,
  getDriverCareerStats,
  getDriverStandingBeforeRace,
} from '../queries';
import { stripYearPrefix } from '../format';
import type { DriverAtRacePayload } from '../api-types';

export async function buildDriverAtRacePayload(
  driverSlug: string,
  seasonStr: string,
  raceSlug: string,
): Promise<DriverAtRacePayload | undefined> {
  const fullSlug = `${seasonStr}-${raceSlug}`;
  const [driver, race] = await Promise.all([
    getDriverBySlug(driverSlug),
    getRaceBySlug(fullSlug),
  ]);
  if (!driver || !race) return undefined;

  const [stats, standing, teamAtRace, raceResult] = await Promise.all([
    getDriverCareerStats(driver.id, race.race_number),
    getDriverStandingBeforeRace(driver.id, race.race_number),
    db
      .select({
        slug: teams.slug,
        name: teams.name,
        primary_color: teams.primaryColor,
      })
      .from(roundEntries)
      .innerJoin(teams, eq(teams.id, roundEntries.teamId))
      .where(and(eq(roundEntries.driverId, driver.id), eq(roundEntries.raceNumber, race.race_number)))
      .get(),
    db
      .select({
        grid: raceResults.grid,
        position: raceResults.position,
        status: raceResults.status,
        detail: raceResults.detail,
        time: raceResults.time,
        points: raceResults.points,
        is_classified: raceResults.isClassified,
        fastest_lap_rank: raceResults.fastestLapRank,
      })
      .from(raceResults)
      .where(and(eq(raceResults.driverId, driver.id), eq(raceResults.raceNumber, race.race_number)))
      .get(),
  ]);

  return {
    driver: {
      slug: driver.slug,
      full_name: driver.full_name,
      abbreviation: driver.abbreviation,
      nationality: driver.nationality,
      date_of_birth: driver.date_of_birth,
      permanent_car_number: driver.permanent_car_number,
    },
    race: {
      slug: stripYearPrefix(race.slug, race.season),
      season: race.season,
      round: race.round,
      name: race.name,
      date: race.date,
      race_number: race.race_number,
    },
    team_at_race: teamAtRace ?? null,
    standing_going_in: standing
      ? { position: standing.position, points: standing.points, win_count: standing.win_count }
      : null,
    career_going_in: stats,
    result_this_race: raceResult ?? null,
  };
}
