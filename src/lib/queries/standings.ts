import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import { driverStandings, teamStandings, drivers, teams } from '../../db/schema';

const prevRaceInSeason = (season: number, raceNumber: number) =>
  sql`(SELECT MAX(r.race_number) FROM races r WHERE r.season = ${season} AND r.race_number < ${raceNumber})`;

export async function getDriverStandingsAtRace(raceNumber: number) {
  return db
    .select({
      driver_id: driverStandings.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      position: driverStandings.position,
      points: driverStandings.points,
      win_count: driverStandings.winCount,
    })
    .from(driverStandings)
    .innerJoin(drivers, eq(drivers.id, driverStandings.driverId))
    .leftJoin(teams, eq(teams.id, driverStandings.teamId))
    .where(eq(driverStandings.raceNumber, raceNumber))
    .orderBy(sql`${driverStandings.position} ASC NULLS LAST`);
}

export async function getTeamStandingsAtRace(raceNumber: number) {
  return db
    .select({
      team_id: teamStandings.teamId,
      team_name: teams.name,
      position: teamStandings.position,
      points: teamStandings.points,
      win_count: teamStandings.winCount,
    })
    .from(teamStandings)
    .innerJoin(teams, eq(teams.id, teamStandings.teamId))
    .where(eq(teamStandings.raceNumber, raceNumber))
    .orderBy(sql`${teamStandings.position} ASC NULLS LAST`);
}

export async function getDriverStandingsBeforeRace(raceNumber: number, season: number) {
  return db
    .select({
      driver_id: driverStandings.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      position: driverStandings.position,
      points: driverStandings.points,
      win_count: driverStandings.winCount,
    })
    .from(driverStandings)
    .innerJoin(drivers, eq(drivers.id, driverStandings.driverId))
    .leftJoin(teams, eq(teams.id, driverStandings.teamId))
    .where(sql`${driverStandings.raceNumber} = ${prevRaceInSeason(season, raceNumber)}`)
    .orderBy(sql`${driverStandings.position} ASC NULLS LAST`);
}

export async function getTeamStandingsBeforeRace(raceNumber: number, season: number) {
  return db
    .select({
      team_id: teamStandings.teamId,
      team_name: teams.name,
      position: teamStandings.position,
      points: teamStandings.points,
      win_count: teamStandings.winCount,
    })
    .from(teamStandings)
    .innerJoin(teams, eq(teams.id, teamStandings.teamId))
    .where(sql`${teamStandings.raceNumber} = ${prevRaceInSeason(season, raceNumber)}`)
    .orderBy(sql`${teamStandings.position} ASC NULLS LAST`);
}
