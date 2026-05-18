import { eq, sql, and, lte, desc } from 'drizzle-orm';
import { db } from '../../db/client';
import { driverStandings, teamStandings, drivers, teams, races, roundEntries } from '../../db/schema';

type DriverStandingRow = {
  driver_id: number;
  driver_slug: string;
  full_name: string;
  team_name: string | null;
  team_slug: string | null;
  position: number | null;
  points: number;
  win_count: number;
};

// Drivers who skipped the last race(s) have a null teamId in their standings row.
// This fills in the team from their most recent round_entry in the season.
async function resolveDriverTeams(
  rows: DriverStandingRow[],
  raceNumber: number,
  season: number,
): Promise<DriverStandingRow[]> {
  const missing = rows.filter((r) => r.team_name == null);
  if (missing.length === 0) return rows;

  const fallbacks = await Promise.all(
    missing.map((r) =>
      db
        .select({ driver_id: roundEntries.driverId, team_name: teams.name, team_slug: teams.slug })
        .from(roundEntries)
        .innerJoin(teams, eq(teams.id, roundEntries.teamId))
        .innerJoin(races, eq(races.raceNumber, roundEntries.raceNumber))
        .where(
          and(
            eq(roundEntries.driverId, r.driver_id),
            eq(races.season, season),
            lte(roundEntries.raceNumber, raceNumber),
          ),
        )
        .orderBy(desc(roundEntries.raceNumber))
        .limit(1)
        .get(),
    ),
  );

  const map = new Map(fallbacks.filter(Boolean).map((f) => [f!.driver_id, f!]));
  return rows.map((r) => ({
    ...r,
    team_name: r.team_name ?? map.get(r.driver_id)?.team_name ?? null,
    team_slug: r.team_slug ?? map.get(r.driver_id)?.team_slug ?? null,
  }));
}

async function queryDriverStandings(raceNumber: number): Promise<DriverStandingRow[]> {
  return db
    .select({
      driver_id: driverStandings.driverId,
      driver_slug: drivers.slug,
      full_name: drivers.fullName,
      team_name: teams.name,
      team_slug: teams.slug,
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

export async function getDriverStandingsAtRace(raceNumber: number) {
  const [rows, seasonRow] = await Promise.all([
    queryDriverStandings(raceNumber),
    db.select({ season: races.season }).from(races).where(eq(races.raceNumber, raceNumber)).get(),
  ]);
  if (!seasonRow) return rows;
  return resolveDriverTeams(rows, raceNumber, seasonRow.season);
}

export async function getTeamStandingsAtRace(raceNumber: number) {
  return db
    .select({
      team_id: teamStandings.teamId,
      team_name: teams.name,
      team_slug: teams.slug,
      position: teamStandings.position,
      points: teamStandings.points,
      win_count: teamStandings.winCount,
    })
    .from(teamStandings)
    .innerJoin(teams, eq(teams.id, teamStandings.teamId))
    .where(eq(teamStandings.raceNumber, raceNumber))
    .orderBy(sql`${teamStandings.position} ASC NULLS LAST`);
}

export async function getDriverStandingsBeforeRace(raceNumber: number) {
  const prevRace = await db
    .select({ prevRn: races.prevRaceInSeason })
    .from(races)
    .where(eq(races.raceNumber, raceNumber))
    .get();
  if (!prevRace?.prevRn) return [];
  const prevRn = prevRace.prevRn;
  const [rows, seasonRow] = await Promise.all([
    queryDriverStandings(prevRn),
    db.select({ season: races.season }).from(races).where(eq(races.raceNumber, prevRn)).get(),
  ]);
  if (!seasonRow) return rows;
  return resolveDriverTeams(rows, prevRn, seasonRow.season);
}

export async function getTeamStandingsBeforeRace(raceNumber: number) {
  const prevRace = await db
    .select({ prevRn: races.prevRaceInSeason })
    .from(races)
    .where(eq(races.raceNumber, raceNumber))
    .get();
  if (!prevRace?.prevRn) return [];
  return db
    .select({
      team_id: teamStandings.teamId,
      team_name: teams.name,
      team_slug: teams.slug,
      position: teamStandings.position,
      points: teamStandings.points,
      win_count: teamStandings.winCount,
    })
    .from(teamStandings)
    .innerJoin(teams, eq(teams.id, teamStandings.teamId))
    .where(eq(teamStandings.raceNumber, prevRace.prevRn))
    .orderBy(sql`${teamStandings.position} ASC NULLS LAST`);
}
