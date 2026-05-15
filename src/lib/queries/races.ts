import { eq, desc, asc } from 'drizzle-orm';
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

export async function getAllRaces(): Promise<{ season: number; race_slug: string }[]> {
  const rows = await db
    .select({ season: races.season, slug: races.slug })
    .from(races)
    .orderBy(asc(races.raceNumber));
  return rows.map((r) => ({ season: r.season, race_slug: stripYearPrefix(r.slug, r.season) }));
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

export async function getLatestRace(): Promise<LatestRace> {
  const row = await db
    .select({ season: races.season, slug: races.slug })
    .from(races)
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
