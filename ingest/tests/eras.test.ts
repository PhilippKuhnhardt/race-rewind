/**
 * Era spot-checks — one verified race per distinct era/format.
 * Facts confirmed against Wikipedia.
 */
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { openDb, skipIfNoDb, type DbHandle } from './helpers';

let handle: DbHandle;

beforeAll(() => {
  const skip = skipIfNoDb();
  if (skip) return;
  handle = openDb();
});

afterAll(() => {
  handle?.client.close();
});

async function race(slug: string) {
  const result = await handle.client.execute(`SELECT * FROM races WHERE slug = '${slug}'`);
  expect(result.rows.length, `Race not found: ${slug}`).toBeGreaterThan(0);
  return result.rows[0] as Record<string, unknown>;
}

async function results(raceNumber: number) {
  const result = await handle.client.execute(`
    SELECT d.full_name, rr.position, rr.grid, rr.laps_completed,
           rr.points, rr.detail, rr.car_number, rr.fastest_lap_rank,
           rr.pit_stop_count, t.name AS team
    FROM race_results rr
    JOIN drivers d ON d.id = rr.driver_id
    JOIN teams   t ON t.id = rr.team_id
    WHERE rr.race_number = ${raceNumber}
  `);
  return Object.fromEntries(
    (result.rows as Record<string, unknown>[]).map(r => [r.full_name, r])
  );
}

async function qualifying(raceNumber: number) {
  const result = await handle.client.execute(`
    SELECT d.full_name, qr.position, qr.q1_time, qr.q2_time, qr.q3_time,
           qr.qualifying_time, qr.knocked_out_in
    FROM qualifying_results qr
    JOIN drivers d ON d.id = qr.driver_id
    WHERE qr.race_number = ${raceNumber}
  `);
  return Object.fromEntries(
    (result.rows as Record<string, unknown>[]).map(r => [r.full_name, r])
  );
}

async function standings(raceNumber: number) {
  const result = await handle.client.execute(`
    SELECT d.full_name, ds.position, ds.points, ds.win_count
    FROM driver_standings ds
    JOIN drivers d ON d.id = ds.driver_id
    WHERE ds.race_number = ${raceNumber} AND ds.position IS NOT NULL
  `);
  return Object.fromEntries(
    (result.rows as Record<string, unknown>[]).map(r => [r.full_name, r])
  );
}

// ---------------------------------------------------------------------------
// 2023 Bahrain Grand Prix — modern era
// ---------------------------------------------------------------------------

describe('2023 Bahrain Grand Prix', () => {
  const SLUG = '2023-bahrain-grand-prix';
  let raceNumber: number;

  beforeAll(async () => {
    const skip = skipIfNoDb();
    if (skip || !handle) return;
    const r = await race(SLUG);
    raceNumber = r.race_number as number;
  });

  it('race meta', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const r = await race(SLUG);
    expect(r.season).toBe(2023);
    expect(r.round).toBe(1);
    expect(r.date).toBe('2023-03-05');
    expect(r.has_sprint).toBe(0);
  });

  it('top 3', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Max Verstappen'].position).toBe(1);
    expect(rr['Max Verstappen'].laps_completed).toBe(57);
    expect(rr['Max Verstappen'].grid).toBe(1);
    expect(rr['Sergio Pérez'].position).toBe(2);
    expect(rr['Fernando Alonso'].position).toBe(3);
    expect(rr['Fernando Alonso'].grid).toBe(5);
  });

  it('Leclerc retired on lap 39', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Charles Leclerc'].grid).toBe(3);
    expect(rr['Charles Leclerc'].laps_completed).toBe(39);
  });

  it('Zhou set fastest lap', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Guanyu Zhou'].fastest_lap_rank).toBe(1);
  });

  it('qualifying pole lap times', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const q = await qualifying(raceNumber);
    expect(q['Max Verstappen'].position).toBe(1);
    expect(q['Max Verstappen'].q3_time).toBe('00:01:29.708');
    expect(q['Sergio Pérez'].q3_time).toBe('00:01:29.846');
  });

  it('qualifying knockouts', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const q = await qualifying(raceNumber);
    expect(q['Lando Norris'].knocked_out_in).toBe('Q2');
    expect(q['Pierre Gasly'].knocked_out_in).toBe('Q1');
  });

  it('driver standings', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const s = await standings(raceNumber);
    expect(s['Max Verstappen'].position).toBe(1);
    expect(s['Max Verstappen'].points).toBe(25);
    expect(s['Sergio Pérez'].position).toBe(2);
    expect(s['Fernando Alonso'].position).toBe(3);
  });

  it('constructor standings', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const result = await handle.client.execute(`
      SELECT t.name, ts.position, ts.points
      FROM team_standings ts JOIN teams t ON t.id = ts.team_id
      WHERE ts.race_number = ${raceNumber} AND ts.position IS NOT NULL
      ORDER BY ts.position
    `);
    const top = Object.fromEntries((result.rows as Record<string, unknown>[]).map(r => [r.name, r]));
    expect(top['Red Bull'].position).toBe(1);
    expect(top['Red Bull'].points).toBe(43);
    expect(top['Aston Martin'].position).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 2004 European Grand Prix — single-lap qualifying era
// ---------------------------------------------------------------------------

describe('2004 European Grand Prix', () => {
  const SLUG = '2004-european-grand-prix';
  let raceNumber: number;

  beforeAll(async () => {
    const skip = skipIfNoDb();
    if (skip || !handle) return;
    const r = await race(SLUG);
    raceNumber = r.race_number as number;
  });

  it('race meta', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const r = await race(SLUG);
    expect(r.season).toBe(2004);
    expect(r.round).toBe(7);
    expect(r.date).toBe('2004-05-30');
  });

  it('Schumacher wins from pole', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Michael Schumacher'].position).toBe(1);
    expect(rr['Michael Schumacher'].grid).toBe(1);
    expect(rr['Michael Schumacher'].laps_completed).toBe(60);
    expect(rr['Michael Schumacher'].fastest_lap_rank).toBe(1);
  });

  it('single-lap qualifying — qualifying_time set, q1_time null', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const q = await qualifying(raceNumber);
    expect(q['Michael Schumacher'].position).toBe(1);
    expect(q['Michael Schumacher'].qualifying_time).toBe('00:01:28.351');
    expect(q['Michael Schumacher'].q1_time).toBeNull();
    expect(q['Michael Schumacher'].q3_time).toBeNull();
  });

  it('standings after: Schumacher 60 pts, 6 wins', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const s = await standings(raceNumber);
    expect(s['Michael Schumacher'].position).toBe(1);
    expect(s['Michael Schumacher'].points).toBe(60);
    expect(s['Michael Schumacher'].win_count).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// 1971 Canadian Grand Prix — classic era, no qualifying data
// ---------------------------------------------------------------------------

describe('1971 Canadian Grand Prix', () => {
  const SLUG = '1971-canadian-grand-prix';
  let raceNumber: number;

  beforeAll(async () => {
    const skip = skipIfNoDb();
    if (skip || !handle) return;
    const r = await race(SLUG);
    raceNumber = r.race_number as number;
  });

  it('race meta', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const r = await race(SLUG);
    expect(r.season).toBe(1971);
    expect(r.round).toBe(10);
    expect(r.date).toBe('1971-09-19');
  });

  it('podium', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Jackie Stewart'].position).toBe(1);
    expect(rr['Ronnie Peterson'].position).toBe(2);
    expect(rr['Mark Donohue'].position).toBe(3);
  });

  it('no qualifying data', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const q = await qualifying(raceNumber);
    expect(Object.keys(q).length).toBe(0);
  });

  it('9-6-4 points system', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Jackie Stewart'].points).toBe(9);
    expect(rr['Ronnie Peterson'].points).toBe(6);
    expect(rr['Mark Donohue'].points).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// 1952 British Grand Prix — early championship era
// ---------------------------------------------------------------------------

describe('1952 British Grand Prix', () => {
  const SLUG = '1952-british-grand-prix';
  let raceNumber: number;

  beforeAll(async () => {
    const skip = skipIfNoDb();
    if (skip || !handle) return;
    const r = await race(SLUG);
    raceNumber = r.race_number as number;
  });

  it('race meta', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const r = await race(SLUG);
    expect(r.season).toBe(1952);
    expect(r.round).toBe(5);
    expect(r.date).toBe('1952-07-19');
  });

  it('Ascari wins', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Alberto Ascari'].position).toBe(1);
    expect(rr['Alberto Ascari'].laps_completed).toBe(85);
  });

  it('Farina starts from pole, finishes P6', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Nino Farina'].grid).toBe(1);
    expect(rr['Nino Farina'].position).toBe(6);
  });

  it('no qualifying data', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const q = await qualifying(raceNumber);
    expect(Object.keys(q).length).toBe(0);
  });

  it('Ascari standings: P1, 27 pts, 3 wins', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const s = await standings(raceNumber);
    expect(s['Alberto Ascari'].position).toBe(1);
    expect(s['Alberto Ascari'].points).toBe(27);
    expect(s['Alberto Ascari'].win_count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 1956 Belgian Grand Prix — shared drive
// ---------------------------------------------------------------------------

describe('1956 Belgian Grand Prix (shared drive)', () => {
  const SLUG = '1956-belgian-grand-prix';
  let raceNumber: number;

  beforeAll(async () => {
    const skip = skipIfNoDb();
    if (skip || !handle) return;
    const r = await race(SLUG);
    raceNumber = r.race_number as number;
  });

  it('race meta', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const r = await race(SLUG);
    expect(r.season).toBe(1956);
    expect(r.round).toBe(4);
    expect(r.date).toBe('1956-06-03');
  });

  it('Collins wins', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Peter Collins'].position).toBe(1);
    expect(rr['Peter Collins'].laps_completed).toBe(36);
  });

  it('Moss+Perdisa share car #34 at P3 with split points', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const rr = await results(raceNumber);
    expect(rr['Stirling Moss'].position).toBe(3);
    expect(rr['Stirling Moss'].car_number).toBe(34);
    expect(rr['Cesare Perdisa'].position).toBe(3);
    expect(rr['Cesare Perdisa'].car_number).toBe(34);
    expect((rr['Stirling Moss'].points as number) + (rr['Cesare Perdisa'].points as number)).toBe(5);
  });

  it('no qualifying data', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;
    const q = await qualifying(raceNumber);
    expect(Object.keys(q).length).toBe(0);
  });
});
