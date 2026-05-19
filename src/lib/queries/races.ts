import { eq, desc, asc, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { races, circuits } from '../../db/schema';
import { stripYearPrefix } from '../format';

export interface RaceNavEntry {
  slug: string;
  name: string;
}

export interface LatestRace {
  season: number;
  slug: string;
}

export async function getAllRacesBySeason(): Promise<{
  seasons: number[];
  byseason: Record<number, RaceNavEntry[]>;
}> {
  const rows = await db
    .select({ season: races.season, slug: races.slug, name: races.name })
    .from(races)
    .orderBy(asc(races.raceNumber));

  const byseason: Record<number, RaceNavEntry[]> = {};
  for (const r of rows) {
    const entry: RaceNavEntry = { slug: stripYearPrefix(r.slug, r.season), name: r.name };
    if (!byseason[r.season]) byseason[r.season] = [];
    byseason[r.season].push(entry);
  }
  const seasonList = Object.keys(byseason).map(Number);
  return { seasons: seasonList, byseason };
}

export async function getAllRaces(): Promise<{ season: number; race_slug: string; race_number: number }[]> {
  const rows = await db
    .select({ season: races.season, slug: races.slug, raceNumber: races.raceNumber })
    .from(races)
    .orderBy(asc(races.raceNumber));
  return rows.map((r) => ({ season: r.season, race_slug: stripYearPrefix(r.slug, r.season), race_number: r.raceNumber }));
}

export async function getRaceBySlug(slug: string) {
  const row = await db
    .select({
      race_number: races.raceNumber,
      slug: races.slug,
      season: races.season,
      round: races.round,
      name: races.name,
      date: races.date,
      has_sprint: races.hasSprint,
      circuit_name: circuits.name,
      circuit_locality: circuits.locality,
      circuit_country: circuits.country,
    })
    .from(races)
    .innerJoin(circuits, eq(circuits.id, races.circuitId))
    .where(eq(races.slug, slug))
    .get();
  return row ?? undefined;
}

export interface SeasonBounds {
  firstRaceNumber: number;
  firstRaceSlug: string;
  firstRaceName: string;
  lastRaceNumber: number;
  lastRaceSlug: string;
  lastRaceName: string;
  raceCount: number;
  nextSeasonFirstRaceNumber: number | null;
}

export async function getSeasonBounds(season: number): Promise<SeasonBounds | undefined> {
  const rows = await db
    .select({ raceNumber: races.raceNumber, slug: races.slug, name: races.name, round: races.round, isFinalRound: races.isFinalRound })
    .from(races)
    .where(eq(races.season, season))
    .orderBy(asc(races.raceNumber));

  if (rows.length === 0) return undefined;

  const first = rows[0];
  const last = rows[rows.length - 1];

  const nextRow = await db
    .select({ raceNumber: races.raceNumber })
    .from(races)
    .where(eq(races.season, season + 1))
    .orderBy(asc(races.raceNumber))
    .limit(1)
    .get();

  return {
    firstRaceNumber: first.raceNumber,
    firstRaceSlug: stripYearPrefix(first.slug, season),
    firstRaceName: first.name,
    lastRaceNumber: last.raceNumber,
    lastRaceSlug: stripYearPrefix(last.slug, season),
    lastRaceName: last.name,
    raceCount: rows.length,
    nextSeasonFirstRaceNumber: nextRow?.raceNumber ?? null,
  };
}

export async function getLatestRace(): Promise<LatestRace> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await db
    .select({ season: races.season, slug: races.slug })
    .from(races)
    .where(lte(races.date, today))
    .orderBy(desc(races.raceNumber))
    .limit(1)
    .get();
  return row!;
}

export async function getAllSeasons(): Promise<number[]> {
  const rows = await db
    .selectDistinct({ season: races.season })
    .from(races)
    .orderBy(asc(races.season));
  return rows.map((r) => r.season);
}

export interface SeasonCalendarRow {
  round: number;
  race_slug: string;
  name: string;
  date: string;
  circuit_name: string;
  circuit_locality: string | null;
  circuit_country: string | null;
}

export async function getSeasonCalendar(season: number): Promise<SeasonCalendarRow[]> {
  const rows = await db
    .select({
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
    .orderBy(asc(races.round));
  return rows.map((r) => ({
    round: r.round,
    race_slug: stripYearPrefix(r.slug, season),
    name: r.name,
    date: r.date,
    circuit_name: r.circuit_name,
    circuit_locality: r.circuit_locality,
    circuit_country: r.circuit_country,
  }));
}
