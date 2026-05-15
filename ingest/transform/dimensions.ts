import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { readCsv, asInt, asFloat, asBool } from '../csv';
import { slugify, driverSlug, deduplicate } from '../slugs';
import { emptyState, type IngestState } from '../state';
import * as schema from '../../src/db/schema';

const CHUNK = 500;

async function insertChunked<T>(
  db: LibSQLDatabase<typeof schema>,
  table: Parameters<typeof db.insert>[0],
  rows: T[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(table).values(rows.slice(i, i + CHUNK) as [T, ...T[]]);
  }
}

export async function loadReference(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
): Promise<void> {
  await loadChampionshipSystems(db, dumpDir);
  await loadPointSystems(db, dumpDir);
  await loadBaseTeams(db, dumpDir);
}

export async function loadDimensions(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
): Promise<IngestState> {
  const state = emptyState();
  state.seasons = await loadSeasons(db, dumpDir);
  state.circuits = await loadCircuits(db, dumpDir);
  state.drivers = await loadDrivers(db, dumpDir);
  state.teams = await loadTeams(db, dumpDir);
  return state;
}

async function loadChampionshipSystems(db: LibSQLDatabase<typeof schema>, dumpDir: string) {
  const rows = readCsv(dumpDir, 'formula_one_championshipsystem.csv');
  const records = rows.map(r => ({
    id: parseInt(r.id, 10),
    jolpicaApiId: r.api_id,
    name: r.name,
    reference: r.reference || null,
    driverBestResults: asInt(r, 'driver_best_results') ?? 0,
    driverSeasonSplit: asInt(r, 'driver_season_split') ?? 0,
    eligibility: asInt(r, 'eligibility') ?? 1,
    teamBestResults: asInt(r, 'team_best_results') ?? 0,
    teamPointsPerSession: asInt(r, 'team_points_per_session') ?? 0,
    teamSeasonSplit: asInt(r, 'team_season_split') ?? 0,
  }));
  await insertChunked(db, schema.championshipSystems, records);
}

async function loadPointSystems(db: LibSQLDatabase<typeof schema>, dumpDir: string) {
  const rows = readCsv(dumpDir, 'formula_one_pointsystem.csv');
  const records = rows.map(r => ({
    id: parseInt(r.id, 10),
    jolpicaApiId: r.api_id,
    name: r.name,
    reference: r.reference || null,
    partial: asInt(r, 'partial') ?? 0,
    driverPositionPoints: r.driver_position_points || null,
    driverFastestLap: asFloat(r, 'driver_fastest_lap') ?? 0,
    teamPositionPoints: r.team_position_points || null,
    teamFastestLap: asFloat(r, 'team_fastest_lap') ?? 0,
    isDoublePoints: asBool(r, 'is_double_points'),
    sharedDrive: asInt(r, 'shared_drive') ?? 0,
  }));
  await insertChunked(db, schema.pointSystems, records);
}

async function loadBaseTeams(db: LibSQLDatabase<typeof schema>, dumpDir: string) {
  const rows = readCsv(dumpDir, 'formula_one_baseteam.csv');
  if (!rows.length) return;
  const records = rows.map(r => ({
    id: parseInt(r.id, 10),
    jolpicaApiId: r.api_id,
    name: r.name || null,
  }));
  await insertChunked(db, schema.baseTeams, records);
}

async function loadSeasons(db: LibSQLDatabase<typeof schema>, dumpDir: string): Promise<Map<number, number>> {
  const rows = readCsv(dumpDir, 'formula_one_season.csv');
  const records = rows.map(r => ({
    year: parseInt(r.year, 10),
    jolpicaId: parseInt(r.id, 10),
    jolpicaApiId: r.api_id,
    championshipSystemId: asInt(r, 'championship_system_id'),
    wikipedia: r.wikipedia || null,
  }));
  await insertChunked(db, schema.seasons, records);
  return new Map(rows.map(r => [parseInt(r.id, 10), parseInt(r.year, 10)]));
}

async function loadCircuits(db: LibSQLDatabase<typeof schema>, dumpDir: string): Promise<Map<number, number>> {
  const rows = readCsv(dumpDir, 'formula_one_circuit.csv');
  const existingSlugs = new Set<string>();
  const records = rows.map(r => {
    const base = r.reference || slugify(r.name);
    const slug = deduplicate(base, existingSlugs);
    existingSlugs.add(slug);
    return {
      slug,
      jolpicaId: parseInt(r.id, 10),
      jolpicaApiId: r.api_id,
      name: r.name,
      locality: r.locality || null,
      country: r.country || null,
      countryCode: r.country_code || null,
      latitude: asFloat(r, 'latitude'),
      longitude: asFloat(r, 'longitude'),
      altitude: asInt(r, 'altitude'),
      reference: r.reference || null,
      wikipedia: r.wikipedia || null,
    };
  });
  await insertChunked(db, schema.circuits, records);
  const inserted = await db.select({ id: schema.circuits.id, jolpicaId: schema.circuits.jolpicaId }).from(schema.circuits);
  return new Map(inserted.map(r => [r.jolpicaId, r.id]));
}

async function loadDrivers(db: LibSQLDatabase<typeof schema>, dumpDir: string): Promise<Map<number, number>> {
  const rows = readCsv(dumpDir, 'formula_one_driver.csv');
  // Sort for stable slug collision suffixes across re-runs
  rows.sort((a, b) => {
    const s = a.surname.localeCompare(b.surname);
    if (s !== 0) return s;
    const f = a.forename.localeCompare(b.forename);
    if (f !== 0) return f;
    return parseInt(a.id, 10) - parseInt(b.id, 10);
  });
  const existingSlugs = new Set<string>();
  const records = rows.map(r => {
    const base = driverSlug(r.forename, r.surname);
    const slug = deduplicate(base, existingSlugs);
    existingSlugs.add(slug);
    return {
      slug,
      jolpicaId: parseInt(r.id, 10),
      jolpicaApiId: r.api_id,
      forename: r.forename,
      surname: r.surname,
      fullName: `${r.forename} ${r.surname}`,
      abbreviation: r.abbreviation || null,
      permanentCarNumber: asInt(r, 'permanent_car_number'),
      countryCode: r.country_code || null,
      nationality: r.nationality || null,
      dateOfBirth: r.date_of_birth || null,
      reference: r.reference || null,
      wikipedia: r.wikipedia || null,
    };
  });
  await insertChunked(db, schema.drivers, records);
  const inserted = await db.select({ id: schema.drivers.id, jolpicaId: schema.drivers.jolpicaId }).from(schema.drivers);
  return new Map(inserted.map(r => [r.jolpicaId, r.id]));
}

async function loadTeams(db: LibSQLDatabase<typeof schema>, dumpDir: string): Promise<Map<number, number>> {
  const rows = readCsv(dumpDir, 'formula_one_team.csv');
  const existingSlugs = new Set<string>();
  const records = rows.map(r => {
    const base = r.reference || slugify(r.name);
    const slug = deduplicate(base, existingSlugs);
    existingSlugs.add(slug);
    return {
      slug,
      jolpicaId: parseInt(r.id, 10),
      jolpicaApiId: r.api_id,
      baseTeamId: asInt(r, 'base_team_id'),
      name: r.name,
      countryCode: r.country_code || null,
      nationality: r.nationality || null,
      primaryColor: r.primary_color || null,
      reference: r.reference || null,
      wikipedia: r.wikipedia || null,
    };
  });
  await insertChunked(db, schema.teams, records);
  const inserted = await db.select({ id: schema.teams.id, jolpicaId: schema.teams.jolpicaId }).from(schema.teams);
  return new Map(inserted.map(r => [r.jolpicaId, r.id]));
}
