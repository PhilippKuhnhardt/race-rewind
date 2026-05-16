import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { qualifyingResults, sprintQualifyingResults, raceResults, sprintResults, drivers, teams } from '../../db/schema';

export async function getRaceNumbersWithQualifying(): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ raceNumber: qualifyingResults.raceNumber })
    .from(qualifyingResults);
  return new Set(rows.map((r) => r.raceNumber));
}

export async function getQualifyingResults(raceNumber: number) {
  return db
    .select({
      position: qualifyingResults.position,
      driver_id: qualifyingResults.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      team_slug: teams.slug,
      q1_time: qualifyingResults.q1Time,
      q2_time: qualifyingResults.q2Time,
      q3_time: qualifyingResults.q3Time,
      qualifying_time: qualifyingResults.qualifyingTime,
      knocked_out_in: qualifyingResults.knockedOutIn,
    })
    .from(qualifyingResults)
    .innerJoin(drivers, eq(drivers.id, qualifyingResults.driverId))
    .innerJoin(teams, eq(teams.id, qualifyingResults.teamId))
    .where(eq(qualifyingResults.raceNumber, raceNumber))
    .orderBy(sql`${qualifyingResults.position} ASC NULLS LAST`);
}

export async function getSprintQualifyingResults(raceNumber: number) {
  return db
    .select({
      position: sprintQualifyingResults.position,
      driver_id: sprintQualifyingResults.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      team_slug: teams.slug,
      sq1_time: sprintQualifyingResults.sq1Time,
      sq2_time: sprintQualifyingResults.sq2Time,
      sq3_time: sprintQualifyingResults.sq3Time,
      knocked_out_in: sprintQualifyingResults.knockedOutIn,
    })
    .from(sprintQualifyingResults)
    .innerJoin(drivers, eq(drivers.id, sprintQualifyingResults.driverId))
    .innerJoin(teams, eq(teams.id, sprintQualifyingResults.teamId))
    .where(eq(sprintQualifyingResults.raceNumber, raceNumber))
    .orderBy(sql`${sprintQualifyingResults.position} ASC NULLS LAST`);
}

export async function getRaceResults(raceNumber: number) {
  return db
    .select({
      position: raceResults.position,
      driver_id: raceResults.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      team_slug: teams.slug,
      car_number: raceResults.carNumber,
      grid: raceResults.grid,
      laps_completed: raceResults.lapsCompleted,
      time: raceResults.time,
      detail: raceResults.detail,
      points: raceResults.points,
      is_classified: raceResults.isClassified,
      fastest_lap_rank: raceResults.fastestLapRank,
      pit_stop_count: raceResults.pitStopCount,
    })
    .from(raceResults)
    .innerJoin(drivers, eq(drivers.id, raceResults.driverId))
    .innerJoin(teams, eq(teams.id, raceResults.teamId))
    .where(eq(raceResults.raceNumber, raceNumber))
    .orderBy(sql`${raceResults.position} ASC NULLS LAST`);
}

export async function getGridOrder(raceNumber: number) {
  return db
    .select({
      grid: raceResults.grid,
      driver_id: raceResults.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      team_slug: teams.slug,
      car_number: raceResults.carNumber,
    })
    .from(raceResults)
    .innerJoin(drivers, eq(drivers.id, raceResults.driverId))
    .innerJoin(teams, eq(teams.id, raceResults.teamId))
    .where(eq(raceResults.raceNumber, raceNumber))
    .orderBy(sql`${raceResults.grid} ASC NULLS LAST`);
}

export async function getSprintResults(raceNumber: number) {
  return db
    .select({
      position: sprintResults.position,
      driver_id: sprintResults.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      team_slug: teams.slug,
      car_number: sprintResults.carNumber,
      grid: sprintResults.grid,
      laps_completed: sprintResults.lapsCompleted,
      time: sprintResults.time,
      detail: sprintResults.detail,
      points: sprintResults.points,
      is_classified: sprintResults.isClassified,
      fastest_lap_rank: sprintResults.fastestLapRank,
      pit_stop_count: sprintResults.pitStopCount,
    })
    .from(sprintResults)
    .innerJoin(drivers, eq(drivers.id, sprintResults.driverId))
    .innerJoin(teams, eq(teams.id, sprintResults.teamId))
    .where(eq(sprintResults.raceNumber, raceNumber))
    .orderBy(sql`${sprintResults.position} ASC NULLS LAST`);
}
