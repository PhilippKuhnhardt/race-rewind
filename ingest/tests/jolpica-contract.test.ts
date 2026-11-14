import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { JolpicaClient } from '../jolpica_api';
import { backfillJolpicaApi } from '../backfill_jolpica_api';
import {
  scheduleResponseSchema, availableResultsResponseSchema, alphaResultResponseSchema,
  driverStandingsResponseSchema, constructorStandingsResponseSchema,
} from '../jolpica_schemas';
import schedule from './fixtures/jolpica-schedule.json';
import results from './fixtures/jolpica-results.json';
import qualifying from './fixtures/jolpica-qualifying.json';
import standings from './fixtures/jolpica-standings.json';
import { skipIfNoDb } from './helpers';

// Reduced live response fixtures. Only legitimately omitted fields are excluded
// from the deletion checks; nullable required fields must still be present.
const contracts = [
  { name: 'schedule', schema: scheduleResponseSchema, fixture: schedule,
    optional: /\.sessions\.\d+\.(number|scheduled_laps)$/ },
  { name: 'available sessions', schema: availableResultsResponseSchema,
    fixture: { data: { available_results: [{ code: 'R' }, { code: 'Q' }, { code: 'SQ' }, { code: 'SR' }, { code: 'FP1' }] } } },
  { name: 'race results', schema: alphaResultResponseSchema, fixture: results, optional: /\.time$|\.driver\.abbreviation$/ },
  { name: 'qualifying', schema: alphaResultResponseSchema, fixture: qualifying,
    optional: /\.time$|\.driver\.abbreviation$|\.results\.\d+\.position$|\.components\.[^.]+\.position$/ },
  { name: 'driver standings', schema: driverStandingsResponseSchema, fixture: standings, optional: /\.Driver\.code$/ },
  { name: 'constructor standings', schema: constructorStandingsResponseSchema,
    fixture: { MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [{
      position: '1', points: '100', wins: '2', Constructor: { name: 'Mercedes' },
    }] }] } } } },
];

function fieldPaths(value: unknown, prefix: string[] = []): string[][] {
  if (Array.isArray(value)) return value.flatMap((item, index) => fieldPaths(item, [...prefix, String(index)]));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => {
    const fieldPath = [...prefix, key];
    return [fieldPath, ...fieldPaths(item, fieldPath)];
  });
}

function deleteField(value: unknown, fieldPath: string[]) {
  let parent = value as Record<string, unknown>;
  for (const key of fieldPath.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
  delete parent[fieldPath.at(-1)!];
}

function withExtraFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withExtraFields);
  if (value === null || typeof value !== 'object') return value;
  // Components is a dynamic record, so additions there must be component objects.
  return Object.fromEntries([...Object.entries(value).map(([key, item]) =>
    [key, key === 'components'
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([name, component]) => [name, withExtraFields(component)]))
      : withExtraFields(item)]), ['new_api_field', { arbitrary: true }]]);
}

for (const contract of contracts) {
  describe(`Jolpica ${contract.name} contract`, () => {
    it('accepts the current response', () => {
      expect(contract.schema.safeParse(contract.fixture).success).toBe(true);
    });

    it('allows additional fields at every object level', () => {
      expect(contract.schema.safeParse(withExtraFields(contract.fixture)).success).toBe(true);
    });

    for (const fieldPath of fieldPaths(contract.fixture).filter(keys =>
      !contract.optional?.test(keys.join('.')) && !/\.components\.[^.]+$/.test(keys.join('.')))) {
      it(`rejects a missing ${fieldPath.join('.')}`, () => {
        const malformed = structuredClone(contract.fixture);
        deleteField(malformed, fieldPath);
        expect(contract.schema.safeParse(malformed).success).toBe(false);
      });
    }
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('Jolpica driver abbreviations', () => {
  it.each(['R', 'SR', 'Q', 'SQ'])('accepts missing and null abbreviations in %s results', (code) => {
    const payload = structuredClone(code === 'R' || code === 'SR' ? results : qualifying);
    payload.data.code = code;
    deleteField(payload, ['data', 'results', '0', 'driver', 'abbreviation']);
    expect(alphaResultResponseSchema.safeParse(payload).success).toBe(true);

    const withNull = { data: { ...payload.data, results: [{
      ...payload.data.results[0], driver: { ...payload.data.results[0].driver, abbreviation: null },
    }] } };
    expect(alphaResultResponseSchema.safeParse(withNull).success).toBe(true);
  });

  it.each(['', 123])('rejects an invalid abbreviation %j', (abbreviation) => {
    const payload = { data: { ...qualifying.data, results: [{
      ...qualifying.data.results[0], driver: { ...qualifying.data.results[0].driver, abbreviation },
    }] } };
    expect(alphaResultResponseSchema.safeParse(payload).success).toBe(false);
  });
});

describe('Jolpica unclassified qualifiers', () => {
  // 2026 round 19: a driver listed without overall or Q2/Q3 positions.
  const unclassified = { data: { ...qualifying.data, results: [{
    ...qualifying.data.results[0], position: undefined, components: {
      Q1: { position: 5, time: '1:33.241' }, Q2: { time: '1:31.639' }, Q3: {},
    },
  }] } };

  it.each(['Q', 'SQ'])('accepts omitted positions in %s results', (code) => {
    expect(alphaResultResponseSchema.safeParse({ data: { ...unclassified.data, code } }).success).toBe(true);
  });

  it.each(['R', 'SR'])('still requires positions in %s results', (code) => {
    const payload = structuredClone(results);
    payload.data.code = code;
    deleteField(payload, ['data', 'results', '0', 'position']);
    expect(alphaResultResponseSchema.safeParse(payload).success).toBe(false);
  });
});

describe('Jolpica contract failure handling', () => {
  it('rejects the old type field instead of silently skipping every session', async () => {
    const client = new JolpicaClient({ fetchImpl: async () => Response.json({
      data: { available_results: [{ type: 'R' }] },
    }) });
    await expect(client.getJson('/results/round_example/', availableResultsResponseSchema))
      .rejects.toThrow('Jolpica API contract violation (https://api.jolpi.ca/results/round_example/): data.available_results.0.code');
  });

  it.each([
    { data: {} },
    { data: { available_results: null } },
    { data: { available_results: [{ code: 123 }] } },
  ])('rejects malformed availability rather than treating it as no data', (payload) => {
    expect(availableResultsResponseSchema.safeParse(payload).success).toBe(false);
  });

  it('accepts genuinely empty availability and result arrays', () => {
    expect(availableResultsResponseSchema.parse({ data: { available_results: [] } }).data.available_results).toEqual([]);
    expect(alphaResultResponseSchema.parse({ data: { code: 'R', results: [] } }).data.results).toEqual([]);
  });

  it('accepts null data and legitimately omitted qualifying times, points and laps', () => {
    const payload = { data: { ...qualifying.data, results: [{
      ...qualifying.data.results[0], time: undefined, components: { Q1: { position: null, time: null } },
    }] } };
    expect(alphaResultResponseSchema.safeParse(payload).success).toBe(true);
  });

  it('accepts cancelled events without championship numbers', () => {
    const payload = structuredClone(schedule);
    payload.data.events[0].round.is_cancelled = true;
    deleteField(payload, ['data', 'events', '0', 'round', 'number']);
    deleteField(payload, ['data', 'events', '0', 'round', 'race_number']);
    expect(scheduleResponseSchema.safeParse(payload).success).toBe(true);
  });

  it.each([
    [scheduleResponseSchema, { ...schedule, data: { events: 'renamed' } }],
    [alphaResultResponseSchema, { data: { ...results.data, results: [{ ...results.data.results[0], points: '25' }] } }],
    [driverStandingsResponseSchema, { MRData: { StandingsTable: { StandingsLists: [{ DriverStandings: [{
      ...standings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0], points: 'unknown',
    }] }] } } }],
  ] as [z.ZodType, unknown][])('rejects invalid field types and numeric strings', (schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(false);
  });

  it.skipIf(skipIfNoDb() !== null)('propagates contract errors through the backfill to its CLI failure handler', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jolpica-contract-'));
    const dbPath = path.join(dir, 'test.sqlite');
    copyFileSync('data/race-rewind.sqlite', dbPath);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
      url.includes('/schedules/') ? schedule : { data: { available_results: [{ type: 'R' }] } },
    )));
    try {
      await expect(backfillJolpicaApi({ dbPath, seasons: [2026], requestBudget: 10, minDelayMs: 1, now: new Date('2026-10-13') }))
        .rejects.toThrow(/Failed to backfill 2026 round 16: Jolpica API contract violation .*data.available_results.0.code/);

      // Exercise the actual CLI entrypoint: GitHub Actions must receive a
      // nonzero exit, even when the dump is unchanged and backfill adds no rows.
      const entrypoint = path.resolve('ingest/backfill_jolpica_api.ts');
      const cli = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
        process.argv = [process.execPath, ${JSON.stringify(entrypoint)}, '--db', ${JSON.stringify(dbPath)}, '--now', '2026-10-13'];
        globalThis.fetch = async (url) => Response.json(
          url.includes('/schedules/') ? ${JSON.stringify(schedule)} : { data: { available_results: [{ type: 'R' }] } }
        );
        await import(${JSON.stringify(entrypoint)});
      `], { encoding: 'utf8', timeout: 15_000 });
      expect(cli.error).toBeUndefined();
      expect(cli.status).toBe(1);
      expect(cli.stderr).toContain('Jolpica API contract violation');
      expect(cli.stderr).toContain('data.available_results.0.code');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('Jolpica backfill of new drivers', () => {
  it.skipIf(skipIfNoDb() !== null)('creates drivers that are missing from the last dump', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'jolpica-new-driver-'));
    const dbPath = path.join(dir, 'test.sqlite');
    copyFileSync('data/race-rewind.sqlite', dbPath);
    const raceNumber = schedule.data.events[0].round.race_number;
    const seed = createClient({ url: `file:${dbPath}` });
    for (const table of ['race_results', 'driver_standings', 'team_standings']) {
      await seed.execute({ sql: `DELETE FROM ${table} WHERE race_number = ?`, args: [raceNumber] });
    }
    seed.close();

    const debutant = { id: 'driver_NewDebut1', given_name: 'Testy', family_name: 'Debutante' };
    const payload = structuredClone(results);
    payload.data.results[0].driver = debutant as typeof payload.data.results[0]['driver'];
    const driverStandings = structuredClone(standings);
    const standingsDriver = driverStandings.MRData.StandingsTable.StandingsLists[0].DriverStandings[0];
    standingsDriver.Driver = { code: 'TDB', givenName: debutant.given_name, familyName: debutant.family_name };
    standingsDriver.Constructors = [{ name: payload.data.results[0].team.name }];

    vi.stubGlobal('fetch', vi.fn(async (url: string) => Response.json(
      url.includes('/schedules/') ? schedule
        : url.includes('/driverstandings/') ? driverStandings
          : url.includes('/constructorstandings/') ? { MRData: { StandingsTable: { StandingsLists: [{ ConstructorStandings: [] }] } } }
            : /\/results\/[^/]+\/R\/$/.test(url) ? payload
              : { data: { available_results: [{ code: 'R' }] } },
    )));
    try {
      const result = await backfillJolpicaApi({ dbPath, seasons: [2026], requestBudget: 10, minDelayMs: 1, now: new Date('2026-10-13') });
      expect(result).toMatchObject({ changed: true, raceResultsAdded: true });

      const check = createClient({ url: `file:${dbPath}` });
      const driver = (await check.execute({ sql: 'SELECT id, slug, full_name, abbreviation FROM drivers WHERE jolpica_api_id = ?', args: [debutant.id] })).rows[0];
      expect(driver).toMatchObject({ slug: 'testy-debutante', full_name: 'Testy Debutante', abbreviation: null });
      const raceRows = await check.execute({ sql: 'SELECT position FROM race_results WHERE race_number = ? AND driver_id = ?', args: [raceNumber, driver.id] });
      expect(raceRows.rows).toHaveLength(1);
      const standingRows = await check.execute({ sql: 'SELECT position FROM driver_standings WHERE race_number = ? AND driver_id = ?', args: [raceNumber, driver.id] });
      expect(standingRows.rows).toHaveLength(1);
      check.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);
});
