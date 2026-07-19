import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { and, eq, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { raceSlug, slugify, deduplicate } from './slugs';
import { JolpicaClient, JolpicaRateLimitError, JolpicaRequestBudgetError, deterministicNegativeId } from './jolpica_api';
import { normalizeRaceWikipediaUrl } from './wikipedia';
import { buildDerived } from './transform/derived';

type Db = LibSQLDatabase<typeof schema>;

type Args = {
  dbPath: string;
  seasons: number[];
  requestBudget: number;
  minDelayMs: number;
  now: Date;
};

type BackfillResult = {
  changed: boolean;
  raceResultsAdded: boolean;
  requestsUsed: number;
  rateLimited: boolean;
};

type ScheduleResponse = {
  data: {
    events: ScheduleEvent[];
  };
};

type ScheduleEvent = {
  round: {
    id: string;
    number?: number | null;
    name?: string | null;
    is_cancelled: boolean;
    race_number?: number | null;
    wikipedia?: string | null;
  };
  circuit: {
    id: string;
    name: string;
    locality?: string | null;
    country_code?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    wikipedia?: string | null;
  };
  schedule: Array<{
    code: string;
    timestamp?: string | null;
    timezone?: string | null;
    sessions: Array<{
      id: string;
      number?: number | null;
      type: string;
      is_cancelled?: boolean | null;
      scheduled_laps?: number | null;
    }>;
  }>;
};

type AvailableResultsResponse = {
  data: {
    available_results?: Array<{ type: ResultType; url: string }>;
  };
};

type ResultType = 'R' | 'Q' | 'SR' | 'SQ' | 'FP1' | 'FP2' | 'FP3';

type AlphaResultResponse = {
  data: {
    code: ResultType;
    sessions: Array<{ id: string; number?: number | null; type: string }>;
    round: { id: string; number?: number | null; race_number?: number | null };
    results: AlphaResult[];
  };
};

type AlphaResult = {
  driver: { id: string; abbreviation?: string | null; given_name: string; family_name: string };
  team: { id: string; name: string };
  position?: number | null;
  position_text?: string | null;
  time?: string | null;
  is_classified?: boolean | null;
  status?: string | null;
  points?: number | null;
  laps?: number | null;
  car_number?: number | null;
  components?: Record<string, { position?: number | null; time?: string | null }>;
};

type LegacyDriverStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{
        DriverStandings: Array<{
          position: string;
          points: string;
          wins: string;
          Driver: { driverId: string; code?: string; givenName: string; familyName: string };
          Constructors: Array<{ constructorId: string; name: string }>;
        }>;
      }>;
    };
  };
};

type LegacyConstructorStandingsResponse = {
  MRData: {
    StandingsTable: {
      StandingsLists: Array<{
        ConstructorStandings: Array<{
          position: string;
          points: string;
          wins: string;
          Constructor: { constructorId: string; name: string };
        }>;
      }>;
    };
  };
};

type LocalIndexes = {
  driverByApiId: Map<string, typeof schema.drivers.$inferSelect>;
  driverByCode: Map<string, typeof schema.drivers.$inferSelect>;
  driverByName: Map<string, typeof schema.drivers.$inferSelect>;
  teamByApiId: Map<string, typeof schema.teams.$inferSelect>;
  teamByName: Map<string, typeof schema.teams.$inferSelect>;
  circuitByApiId: Map<string, typeof schema.circuits.$inferSelect>;
};

function parseArgs(argv = process.argv.slice(2)): Args {
  let dbPath = 'data/race-rewind.sqlite';
  const seasons: number[] = [];
  let requestBudget = parsePositiveInt(process.env.JOLPICA_BACKFILL_REQUEST_BUDGET ?? '250', 'JOLPICA_BACKFILL_REQUEST_BUDGET');
  let minDelayMs = parsePositiveInt(process.env.JOLPICA_BACKFILL_MIN_DELAY_MS ?? '500', 'JOLPICA_BACKFILL_MIN_DELAY_MS');
  let now = new Date();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--db' && argv[i + 1]) dbPath = argv[++i];
    else if (arg === '--season' && argv[i + 1]) seasons.push(parsePositiveInt(argv[++i], '--season'));
    else if (arg === '--request-budget' && argv[i + 1]) requestBudget = parsePositiveInt(argv[++i], '--request-budget');
    else if (arg === '--min-delay-ms' && argv[i + 1]) minDelayMs = parsePositiveInt(argv[++i], '--min-delay-ms');
    else if (arg === '--now' && argv[i + 1]) now = new Date(argv[++i]);
  }

  if (Number.isNaN(now.getTime())) throw new Error('Invalid --now value');
  return { dbPath: path.resolve(dbPath), seasons, requestBudget, minDelayMs, now };
}

function parsePositiveInt(value: string, name: string): number {
  const n = parseInt(value, 10);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
  return n;
}

function setOutput(name: string, value: string | number | boolean) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) appendFileSync(outputPath, `${name}=${value}\n`);
}

export async function backfillJolpicaApi(args: Args): Promise<BackfillResult> {
  const client = createClient({ url: `file:${args.dbPath}` });
  const db = drizzle(client, { schema });
  const api = new JolpicaClient({ requestBudget: args.requestBudget, minDelayMs: args.minDelayMs });
  let changed = false;
  let raceResultsAdded = false;

  await client.execute('PRAGMA foreign_keys = ON');

  try {
    const seasons = args.seasons.length ? args.seasons : [await latestSeason(db)];
    for (const season of seasons) {
      const schedule = await api.getJson<ScheduleResponse>(`/f1/alpha/schedules/${season}/`);
      const indexes = await loadIndexes(db);
      for (const event of schedule.data.events) {
        if (!shouldInspectEvent(event, args.now)) continue;
        try {
          const { race: localRace, didChange: didUpdateRace } = await ensureRaceAndSessions(db, season, event, indexes);
          changed ||= didUpdateRace;
          const available = await api.getJson<AvailableResultsResponse>(`/f1/alpha/results/${event.round.id}/`);
          const neededTypes = await resultTypesToFetch(available.data.available_results ?? [], localRace.raceNumber, client);
          const payloads: AlphaResultResponse[] = [];
          for (const type of neededTypes) {
            payloads.push(await api.getJson<AlphaResultResponse>(`/f1/alpha/results/${event.round.id}/${type}/`));
          }

          await client.execute('BEGIN');
          try {
            let didChange = false;
            let didAddRaceResult = false;
            for (const payload of payloads) {
              const inserted = await insertResult(db, client, localRace.raceNumber, payload, indexes);
              didChange ||= inserted;
              didAddRaceResult ||= inserted && payload.data.code === 'R';
            }
            if (didAddRaceResult) {
              await insertStandings(db, api, season, event.round.number!, localRace.raceNumber, indexes);
            }
            await client.execute('COMMIT');
            const roundChanged = { didChange, didAddRaceResult };
            changed ||= roundChanged.didChange;
            raceResultsAdded ||= roundChanged.didAddRaceResult;
          } catch (error) {
            await client.execute('ROLLBACK');
            throw error;
          }
        } catch (error) {
          if (error instanceof JolpicaRateLimitError || error instanceof JolpicaRequestBudgetError) throw error;
          throw new Error(`Failed to backfill ${season} round ${event.round.number ?? event.round.id}: ${(error as Error).message}`, { cause: error });
        }
      }
    }

    if (changed) await rebuildDerived(db, client);
    await checkIntegrity(client);

    return { changed, raceResultsAdded, requestsUsed: api.requestsUsed, rateLimited: api.rateLimited };
  } catch (error) {
    if (error instanceof JolpicaRateLimitError || error instanceof JolpicaRequestBudgetError) {
      console.warn(error.message);
      if (changed) {
        await rebuildDerived(db, client);
        await checkIntegrity(client);
      }
      return { changed, raceResultsAdded, requestsUsed: api.requestsUsed, rateLimited: error instanceof JolpicaRateLimitError || api.rateLimited };
    }
    throw error;
  } finally {
    client.close();
  }
}

async function latestSeason(db: Db): Promise<number> {
  const row = await db.select({ season: sql<number>`MAX(${schema.seasons.year})` }).from(schema.seasons).get();
  if (!row?.season) throw new Error('No seasons found in database');
  return row.season;
}

async function loadIndexes(db: Db): Promise<LocalIndexes> {
  const drivers = await db.select().from(schema.drivers);
  const teams = await db.select().from(schema.teams);
  const circuits = await db.select().from(schema.circuits);
  return {
    driverByApiId: new Map(drivers.map(d => [d.jolpicaApiId, d])),
    driverByCode: uniqueMap(drivers.filter(d => d.abbreviation).map(d => [d.abbreviation!, d])),
    driverByName: uniqueMap(drivers.map(d => [normalizeName(d.fullName), d])),
    teamByApiId: new Map(teams.map(t => [t.jolpicaApiId, t])),
    teamByName: uniqueMap(teams.map(t => [normalizeName(t.name), t])),
    circuitByApiId: new Map(circuits.map(c => [c.jolpicaApiId, c])),
  };
}

function uniqueMap<T>(entries: Array<[string, T]>): Map<string, T> {
  const counts = new Map<string, number>();
  for (const [key] of entries) counts.set(key, (counts.get(key) ?? 0) + 1);
  return new Map(entries.filter(([key]) => counts.get(key) === 1));
}

function normalizeName(value: string): string {
  return slugify(value).replaceAll('-', '');
}

function shouldInspectEvent(event: ScheduleEvent, now: Date): boolean {
  if (event.round.is_cancelled || !event.round.race_number || !event.round.number) return false;
  return event.schedule.some(group => group.timestamp && new Date(group.timestamp) <= now);
}

async function ensureRaceAndSessions(
  db: Db,
  season: number,
  event: ScheduleEvent,
  indexes: LocalIndexes,
): Promise<{ race: typeof schema.races.$inferSelect; didChange: boolean }> {
  let race = await db.select().from(schema.races).where(eq(schema.races.jolpicaApiId, event.round.id)).get();
  let didChange = false;
  const wikipedia = normalizeRaceWikipediaUrl(event.round.wikipedia);

  if (!race) {
    const circuit = await ensureCircuit(db, event, indexes);
    const existingSlugs = new Set((await db.select({ slug: schema.races.slug }).from(schema.races)).map(r => r.slug));
    const slug = deduplicate(raceSlug(season, event.round.name ?? `Round ${event.round.number}`), existingSlugs);
    await db.insert(schema.races).values({
      raceNumber: event.round.race_number!,
      slug,
      jolpicaId: deterministicNegativeId(event.round.id),
      jolpicaApiId: event.round.id,
      season,
      round: event.round.number!,
      circuitId: circuit.id,
      name: event.round.name ?? `Round ${event.round.number}`,
      date: firstRaceDate(event),
      hasSprint: event.schedule.some(group => group.code === 'SR') ? 1 : 0,
      wikipedia,
    });
    race = await db.select().from(schema.races).where(eq(schema.races.jolpicaApiId, event.round.id)).get();
    if (!race) throw new Error(`Failed to insert race ${event.round.id}`);
    didChange = true;
  } else if (event.round.wikipedia && race.wikipedia !== wikipedia) {
    await db.update(schema.races)
      .set({ wikipedia })
      .where(eq(schema.races.raceNumber, race.raceNumber));
    race = await db.select().from(schema.races).where(eq(schema.races.jolpicaApiId, event.round.id)).get();
    if (!race) throw new Error(`Failed to reload race ${event.round.id}`);
    didChange = true;
  }

  for (const group of event.schedule) {
    for (const session of group.sessions) {
      const existing = await db.select({ id: schema.sessions.id }).from(schema.sessions).where(eq(schema.sessions.jolpicaApiId, session.id)).get();
      if (existing) continue;
      await db.insert(schema.sessions).values({
        jolpicaId: deterministicNegativeId(session.id),
        jolpicaApiId: session.id,
        raceNumber: race.raceNumber,
        type: session.type,
        number: session.number ?? null,
        pointSystemId: null,
        scheduledLaps: session.scheduled_laps ?? null,
        timestamp: group.timestamp ?? null,
        timezone: group.timezone ?? null,
        hasTimeData: group.timestamp ? 1 : 0,
        isCancelled: session.is_cancelled ? 1 : 0,
      });
    }
  }

  return { race, didChange };
}

async function ensureCircuit(db: Db, event: ScheduleEvent, indexes: LocalIndexes): Promise<typeof schema.circuits.$inferSelect> {
  const existing = indexes.circuitByApiId.get(event.circuit.id);
  if (existing) return existing;
  const existingSlugs = new Set((await db.select({ slug: schema.circuits.slug }).from(schema.circuits)).map(c => c.slug));
  const slug = deduplicate(slugify(event.circuit.name), existingSlugs);
  await db.insert(schema.circuits).values({
    slug,
    jolpicaId: deterministicNegativeId(event.circuit.id),
    jolpicaApiId: event.circuit.id,
    name: event.circuit.name,
    locality: event.circuit.locality ?? null,
    country: event.circuit.country ?? null,
    countryCode: event.circuit.country_code ?? null,
    latitude: event.circuit.latitude ?? null,
    longitude: event.circuit.longitude ?? null,
    altitude: event.circuit.altitude == null ? null : Math.round(event.circuit.altitude),
    reference: null,
    wikipedia: event.circuit.wikipedia ?? null,
  });
  const circuit = await db.select().from(schema.circuits).where(eq(schema.circuits.jolpicaApiId, event.circuit.id)).get();
  if (!circuit) throw new Error(`Failed to insert circuit ${event.circuit.id}`);
  indexes.circuitByApiId.set(circuit.jolpicaApiId, circuit);
  return circuit;
}

function firstRaceDate(event: ScheduleEvent): string {
  const raceGroup = event.schedule.find(group => group.code === 'R') ?? event.schedule.find(group => group.timestamp);
  return raceGroup?.timestamp?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
}

async function resultTypesToFetch(
  available: Array<{ type: ResultType }>,
  raceNumber: number,
  client: Client,
): Promise<ResultType[]> {
  const types = available.map(r => r.type).filter(type => ['Q', 'SQ', 'SR', 'R'].includes(type));
  const needed: ResultType[] = [];
  for (const type of types) {
    if (type === 'Q' && !await hasRows(client, 'qualifying_results', raceNumber)) needed.push(type);
    if (type === 'SQ' && !await hasRows(client, 'sprint_qualifying_results', raceNumber)) needed.push(type);
    if (type === 'SR' && !await hasRows(client, 'sprint_results', raceNumber)) needed.push(type);
    if (type === 'R' && !await hasRows(client, 'race_results', raceNumber)) needed.push(type);
  }
  return needed;
}

async function insertResult(
  db: Db,
  client: Client,
  raceNumber: number,
  payload: AlphaResultResponse,
  indexes: LocalIndexes,
): Promise<boolean> {
  if (!hasResultRows(payload)) return false;
  if (payload.data.code === 'R' && await hasRows(client, 'race_results', raceNumber)) return false;
  if (payload.data.code === 'SR' && await hasRows(client, 'sprint_results', raceNumber)) return false;
  if (payload.data.code === 'Q' && await hasRows(client, 'qualifying_results', raceNumber)) return false;
  if (payload.data.code === 'SQ' && await hasRows(client, 'sprint_qualifying_results', raceNumber)) return false;

  await ensureRoundEntries(db, raceNumber, payload.data.results, indexes);
  if (payload.data.code === 'R' || payload.data.code === 'SR') {
    await insertRaceLikeResult(db, raceNumber, payload, indexes);
  } else {
    await insertQualifyingLikeResult(db, raceNumber, payload, indexes);
  }
  await insertSessionEntries(db, raceNumber, payload, indexes);
  return true;
}

export function hasResultRows(payload: { data: { results: readonly unknown[] } }): boolean {
  return payload.data.results.length > 0;
}

async function hasRows(client: Client, table: string, raceNumber: number): Promise<boolean> {
  const result = await client.execute({ sql: `SELECT 1 FROM ${table} WHERE race_number = ? LIMIT 1`, args: [raceNumber] });
  return result.rows.length > 0;
}

async function ensureRoundEntries(db: Db, raceNumber: number, results: AlphaResult[], indexes: LocalIndexes) {
  for (const result of results) {
    const driver = resolveDriver(result.driver.id, result.driver.abbreviation, result.driver.given_name, result.driver.family_name, indexes);
    const team = resolveTeam(result.team.id, result.team.name, indexes);
    const apiId = `api_backfill:round_entry:${raceNumber}:${driver.jolpicaApiId}:${team.jolpicaApiId}`;
    const existing = await db.select({ id: schema.roundEntries.id }).from(schema.roundEntries).where(eq(schema.roundEntries.jolpicaApiId, apiId)).get();
    if (existing) continue;
    const byDriverRace = await db
      .select({ id: schema.roundEntries.id })
      .from(schema.roundEntries)
      .where(and(eq(schema.roundEntries.raceNumber, raceNumber), eq(schema.roundEntries.driverId, driver.id)))
      .get();
    if (byDriverRace) continue;
    await db.insert(schema.roundEntries).values({
      jolpicaId: deterministicNegativeId(apiId),
      jolpicaApiId: apiId,
      raceNumber,
      driverId: driver.id,
      teamId: team.id,
      carNumber: result.car_number ?? null,
    });
  }
}

async function insertRaceLikeResult(db: Db, raceNumber: number, payload: AlphaResultResponse, indexes: LocalIndexes) {
  const table = payload.data.code === 'R' ? schema.raceResults : schema.sprintResults;
  const rows = payload.data.results.map((result) => {
    const driver = resolveDriver(result.driver.id, result.driver.abbreviation, result.driver.given_name, result.driver.family_name, indexes);
    const team = resolveTeam(result.team.id, result.team.name, indexes);
    return {
      raceNumber,
      driverId: driver.id,
      teamId: team.id,
      carNumber: result.car_number ?? null,
      grid: result.components?.GRID?.position ?? null,
      position: result.position ?? null,
      status: statusCode(result.status),
      detail: result.status === 'FINISHED' ? 'Finished' : (result.status ? titleCase(result.status) : null),
      time: result.time ? normalizeRaceTime(result.time) : null,
      lapsCompleted: result.laps ?? null,
      points: result.points ?? null,
      isClassified: result.is_classified == null ? null : (result.is_classified ? 1 : 0),
      fastestLapRank: result.components?.FLAP?.position ?? null,
      pitStopCount: 0,
    };
  });
  if (rows.length) await db.insert(table).values(rows as [typeof rows[number], ...typeof rows]);
}

async function insertQualifyingLikeResult(db: Db, raceNumber: number, payload: AlphaResultResponse, indexes: LocalIndexes) {
  if (payload.data.code === 'Q') {
    const rows = payload.data.results.map((result) => {
      const driver = resolveDriver(result.driver.id, result.driver.abbreviation, result.driver.given_name, result.driver.family_name, indexes);
      const team = resolveTeam(result.team.id, result.team.name, indexes);
      const components = result.components ?? {};
      return {
        raceNumber,
        driverId: driver.id,
        teamId: team.id,
        position: result.position ?? null,
        q1Time: normalizeLapTime(components.Q1?.time),
        q2Time: normalizeLapTime(components.Q2?.time),
        q3Time: normalizeLapTime(components.Q3?.time),
        qualifyingTime: null,
        knockedOutIn: components.Q3 ? null : components.Q2 ? 'Q2' : 'Q1',
      };
    });
    if (rows.length) await db.insert(schema.qualifyingResults).values(rows as [typeof rows[number], ...typeof rows]);
  } else {
    const rows = payload.data.results.map((result) => {
      const driver = resolveDriver(result.driver.id, result.driver.abbreviation, result.driver.given_name, result.driver.family_name, indexes);
      const team = resolveTeam(result.team.id, result.team.name, indexes);
      const components = result.components ?? {};
      return {
        raceNumber,
        driverId: driver.id,
        teamId: team.id,
        position: result.position ?? null,
        sq1Time: normalizeLapTime(components.SQ1?.time),
        sq2Time: normalizeLapTime(components.SQ2?.time),
        sq3Time: normalizeLapTime(components.SQ3?.time),
        knockedOutIn: components.SQ3 ? null : components.SQ2 ? 'SQ2' : 'SQ1',
      };
    });
    if (rows.length) await db.insert(schema.sprintQualifyingResults).values(rows as [typeof rows[number], ...typeof rows]);
  }
}

async function insertSessionEntries(db: Db, raceNumber: number, payload: AlphaResultResponse, indexes: LocalIndexes) {
  const sessions = await db.select().from(schema.sessions).where(eq(schema.sessions.raceNumber, raceNumber));
  const sessionsByType = new Map(sessions.map(s => [s.type, s]));
  for (const result of payload.data.results) {
    const driver = resolveDriver(result.driver.id, result.driver.abbreviation, result.driver.given_name, result.driver.family_name, indexes);
    const roundEntry = await db
      .select()
      .from(schema.roundEntries)
      .where(and(eq(schema.roundEntries.raceNumber, raceNumber), eq(schema.roundEntries.driverId, driver.id)))
      .get();
    if (!roundEntry) throw new Error(`Missing round entry for ${driver.fullName} at race ${raceNumber}`);

    const componentTypes = payload.data.code === 'Q'
      ? ['Q1', 'Q2', 'Q3'].filter(type => result.components?.[type])
      : payload.data.code === 'SQ'
        ? ['SQ1', 'SQ2', 'SQ3'].filter(type => result.components?.[type])
        : [payload.data.code];

    for (const type of componentTypes) {
      const session = sessionsByType.get(type);
      if (!session) continue;
      const apiId = `api_backfill:session_entry:${session.jolpicaApiId}:${driver.jolpicaApiId}`;
      const existing = await db.select({ id: schema.sessionEntries.id }).from(schema.sessionEntries).where(eq(schema.sessionEntries.jolpicaApiId, apiId)).get();
      if (existing) continue;
      const component = result.components?.[type];
      await db.insert(schema.sessionEntries).values({
        jolpicaId: deterministicNegativeId(apiId),
        jolpicaApiId: apiId,
        sessionId: session.id,
        roundEntryId: roundEntry.id,
        grid: payload.data.code === 'R' || payload.data.code === 'SR' ? result.components?.GRID?.position ?? null : null,
        position: component?.position ?? result.position ?? null,
        lapsCompleted: result.laps ?? null,
        status: statusCode(result.status),
        detail: result.status === 'FINISHED' ? 'Finished' : (result.status ? titleCase(result.status) : null),
        time: payload.data.code === 'R' || payload.data.code === 'SR' ? normalizeRaceTime(result.time) : normalizeLapTime(component?.time),
        points: result.points ?? null,
        isClassified: result.is_classified == null ? null : (result.is_classified ? 1 : 0),
        isEligibleForPoints: null,
        fastestLapRank: result.components?.FLAP?.position ?? null,
      });
    }
  }
}

async function insertStandings(
  db: Db,
  api: JolpicaClient,
  season: number,
  round: number,
  raceNumber: number,
  indexes: LocalIndexes,
) {
  if (!await hasRowsRaw(db, schema.driverStandings, raceNumber)) {
    const standings = await api.getJson<LegacyDriverStandingsResponse>(`/ergast/f1/${season}/${round}/driverstandings/`);
    const rows = standings.MRData.StandingsTable.StandingsLists[0]?.DriverStandings.map((row) => {
      const driver = resolveDriver(null, row.Driver.code, row.Driver.givenName, row.Driver.familyName, indexes);
      const constructor = row.Constructors[0];
      const team = constructor ? resolveTeam(null, constructor.name, indexes) : null;
      return {
        raceNumber,
        driverId: driver.id,
        teamId: team?.id ?? null,
        position: parseInt(row.position, 10),
        points: parseFloat(row.points),
        winCount: parseInt(row.wins, 10),
        highestFinish: null,
        isEligible: 1,
        adjustmentType: 0,
      };
    }) ?? [];
    if (rows.length) await db.insert(schema.driverStandings).values(rows as [typeof rows[number], ...typeof rows]);
  }

  if (!await hasRowsRaw(db, schema.teamStandings, raceNumber)) {
    const standings = await api.getJson<LegacyConstructorStandingsResponse>(`/ergast/f1/${season}/${round}/constructorstandings/`);
    const rows = standings.MRData.StandingsTable.StandingsLists[0]?.ConstructorStandings.map((row) => {
      const team = resolveTeam(null, row.Constructor.name, indexes);
      return {
        raceNumber,
        teamId: team.id,
        position: parseInt(row.position, 10),
        points: parseFloat(row.points),
        winCount: parseInt(row.wins, 10),
        highestFinish: null,
        isEligible: 1,
        adjustmentType: 0,
      };
    }) ?? [];
    if (rows.length) await db.insert(schema.teamStandings).values(rows as [typeof rows[number], ...typeof rows]);
  }
}

async function hasRowsRaw(db: Db, table: typeof schema.driverStandings | typeof schema.teamStandings, raceNumber: number): Promise<boolean> {
  const row = await db.select({ raceNumber: table.raceNumber }).from(table).where(eq(table.raceNumber, raceNumber)).get();
  return row != null;
}

function resolveDriver(
  apiId: string | null,
  code: string | null | undefined,
  givenName: string,
  familyName: string,
  indexes: LocalIndexes,
): typeof schema.drivers.$inferSelect {
  if (apiId && indexes.driverByApiId.has(apiId)) return indexes.driverByApiId.get(apiId)!;
  if (code && indexes.driverByCode.has(code)) return indexes.driverByCode.get(code)!;
  const byName = indexes.driverByName.get(normalizeName(`${givenName} ${familyName}`));
  if (byName) return byName;
  throw new Error(`Could not resolve driver ${apiId ?? code ?? `${givenName} ${familyName}`}`);
}

function resolveTeam(
  apiId: string | null,
  name: string,
  indexes: LocalIndexes,
): typeof schema.teams.$inferSelect {
  if (apiId && indexes.teamByApiId.has(apiId)) return indexes.teamByApiId.get(apiId)!;
  const byName = indexes.teamByName.get(normalizeName(name));
  if (byName) return byName;
  throw new Error(`Could not resolve team ${apiId ?? name}`);
}

function statusCode(status: string | null | undefined): number | null {
  if (!status) return null;
  if (status === 'FINISHED') return 0;
  if (status === 'RETIRED') return 11;
  return null;
}

function titleCase(value: string): string {
  return value.toLowerCase().replace(/(^|_)([a-z])/g, (_, sep: string, char: string) => `${sep ? ' ' : ''}${char.toUpperCase()}`);
}

export function normalizeLapTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length === 2) return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  if (parts.length === 3) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  return value;
}

export function normalizeRaceTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const parts = value.split(':');
  if (parts.length === 2) return `00:${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  if (parts.length === 3) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  return value;
}

async function rebuildDerived(db: Db, client: Client) {
  await client.execute('DELETE FROM driver_career_progression');
  await client.execute('DELETE FROM team_career_progression');
  await client.execute('UPDATE races SET prev_race_in_season = NULL, is_final_round = 0, pole_driver_id = NULL');
  await buildDerived(db, client);
}

async function checkIntegrity(client: Client) {
  const violations = await client.execute('PRAGMA foreign_key_check');
  if (violations.rows.length) throw new Error(`Foreign key check failed with ${violations.rows.length} violation(s)`);
}

async function main() {
  const args = parseArgs();
  const result = await backfillJolpicaApi(args);
  console.log(`Jolpica backfill changed=${result.changed} race_results_added=${result.raceResultsAdded} requests=${result.requestsUsed} rate_limited=${result.rateLimited}`);
  setOutput('backfill_changed', result.changed);
  setOutput('race_results_added', result.raceResultsAdded);
  setOutput('api_requests_used', result.requestsUsed);
  setOutput('rate_limited', result.rateLimited);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
