import { eq, and, lt, min } from 'drizzle-orm';
import { db } from '../../db/client';
import { teams, races, roundEntries, teamStandings, teamCareerProgression } from '../../db/schema';
import { stripYearPrefix } from '../format';

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
