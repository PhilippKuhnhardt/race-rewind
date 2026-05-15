import type { Client } from '@libsql/client';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { readCsv } from '../csv';
import * as schema from '../../src/db/schema';

const CHUNK = 500;

interface RawResult {
  seId: number;
  seJolpicaId: number;
  sessionType: string;
  raceNumber: number;
  driverId: number;
  teamId: number;
  carNumber: number | null;
  grid: number | null;
  position: number | null;
  lapsCompleted: number | null;
  status: number | null;
  detail: string | null;
  time: string | null;
  points: number | null;
  isClassified: number | null;
  fastestLapRank: number | null;
}

function better(a: RawResult, b: RawResult): RawResult {
  if (a.position != null && b.position != null) return a.position < b.position ? a : b;
  if (a.position != null) return a;
  if (b.position != null) return b;
  const aLaps = a.lapsCompleted ?? 0;
  const bLaps = b.lapsCompleted ?? 0;
  if (aLaps !== bLaps) return aLaps > bLaps ? a : b;
  return a.seId < b.seId ? a : b;
}

export async function buildResults(
  db: LibSQLDatabase<typeof schema>,
  client: Client,
  dumpDir: string,
): Promise<void> {
  const pitCounts = loadPitCounts(dumpDir);
  const qLapTimes = loadQualifyingLapTimes(dumpDir);

  await buildRaceAndSprintResults(db, client, pitCounts);
  await buildQualifyingResults(db, client, qLapTimes);
  await buildSprintQualifyingResults(db, client, qLapTimes);
}

function loadPitCounts(dumpDir: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of readCsv(dumpDir, 'formula_one_pitstop.csv')) {
    if (!r.session_entry_id) continue;
    counts.set(r.session_entry_id, (counts.get(r.session_entry_id) ?? 0) + 1);
  }
  return counts;
}

function loadQualifyingLapTimes(dumpDir: string): Map<string, string> {
  const times = new Map<string, string>();
  for (const r of readCsv(dumpDir, 'formula_one_lap.csv')) {
    if (r.is_entry_fastest_lap === 't' && r.time) {
      times.set(r.session_entry_id, r.time);
    }
  }
  return times;
}

async function buildRaceAndSprintResults(
  db: LibSQLDatabase<typeof schema>,
  client: Client,
  pitCounts: Map<string, number>,
): Promise<void> {
  const rows = await client.execute(`
    SELECT se.id AS se_id,
           se.jolpica_id AS se_jolpica_id,
           s.type AS session_type,
           re.race_number,
           re.driver_id,
           re.team_id,
           re.car_number,
           se.grid,
           se.position,
           se.laps_completed,
           se.status,
           se.detail,
           se.time,
           se.points,
           se.is_classified,
           se.fastest_lap_rank
    FROM session_entries se
    JOIN sessions s ON s.id = se.session_id
    JOIN round_entries re ON re.id = se.round_entry_id
    WHERE s.type IN ('R', 'SR')
  `);

  // Dedup to best result per (race_number, driver_id, session_type)
  const best = new Map<string, RawResult>();
  for (const row of rows.rows as Record<string, unknown>[]) {
    const key = `${row.race_number}:${row.driver_id}:${row.session_type}`;
    const candidate: RawResult = {
      seId: row.se_id as number,
      seJolpicaId: row.se_jolpica_id as number,
      sessionType: row.session_type as string,
      raceNumber: row.race_number as number,
      driverId: row.driver_id as number,
      teamId: row.team_id as number,
      carNumber: row.car_number as number | null,
      grid: row.grid as number | null,
      position: row.position as number | null,
      lapsCompleted: row.laps_completed as number | null,
      status: row.status as number | null,
      detail: row.detail as string | null,
      time: row.time as string | null,
      points: row.points as number | null,
      isClassified: row.is_classified as number | null,
      fastestLapRank: row.fastest_lap_rank as number | null,
    };
    const existing = best.get(key);
    best.set(key, existing ? better(existing, candidate) : candidate);
  }

  const raceRecords: typeof schema.raceResults.$inferInsert[] = [];
  const sprintRecords: typeof schema.sprintResults.$inferInsert[] = [];

  for (const r of best.values()) {
    const record = {
      raceNumber: r.raceNumber,
      driverId: r.driverId,
      teamId: r.teamId,
      carNumber: r.carNumber,
      grid: r.grid,
      position: r.position,
      status: r.status,
      detail: r.detail,
      time: r.time,
      lapsCompleted: r.lapsCompleted,
      points: r.points,
      isClassified: r.isClassified,
      fastestLapRank: r.fastestLapRank,
      pitStopCount: pitCounts.get(String(r.seJolpicaId)) ?? 0,
    };
    if (r.sessionType === 'R') raceRecords.push(record);
    else sprintRecords.push(record);
  }

  for (let i = 0; i < raceRecords.length; i += CHUNK) {
    await db.insert(schema.raceResults).values(raceRecords.slice(i, i + CHUNK) as [typeof schema.raceResults.$inferInsert, ...typeof schema.raceResults.$inferInsert[]]);
  }
  for (let i = 0; i < sprintRecords.length; i += CHUNK) {
    await db.insert(schema.sprintResults).values(sprintRecords.slice(i, i + CHUNK) as [typeof schema.sprintResults.$inferInsert, ...typeof schema.sprintResults.$inferInsert[]]);
  }
}

async function buildQualifyingResults(
  db: LibSQLDatabase<typeof schema>,
  client: Client,
  lapTimes: Map<string, string>,
): Promise<void> {
  const rows = await client.execute(`
    SELECT se.id, se.jolpica_id, se.position,
           s.type AS session_type,
           re.race_number, re.driver_id, re.team_id
    FROM session_entries se
    JOIN sessions s ON s.id = se.session_id
    JOIN round_entries re ON re.id = se.round_entry_id
    WHERE s.type IN ('Q1','Q2','Q3','QB','QO','QA')
    ORDER BY re.race_number, re.driver_id, s.type
  `);

  const byDriver = new Map<string, Array<{ id: number; jolpicaId: number; position: number | null; sessionType: string; teamId: number }> >();
  for (const row of rows.rows as Record<string, unknown>[]) {
    const key = `${row.race_number}:${row.driver_id}`;
    if (!byDriver.has(key)) byDriver.set(key, []);
    byDriver.get(key)!.push({
      id: row.id as number,
      jolpicaId: row.jolpica_id as number,
      position: row.position as number | null,
      sessionType: row.session_type as string,
      teamId: row.team_id as number,
    });
  }

  const records: typeof schema.qualifyingResults.$inferInsert[] = [];

  for (const [key, entries] of byDriver) {
    const [raceNumberStr, driverIdStr] = key.split(':');
    const raceNumber = parseInt(raceNumberStr, 10);
    const driverId = parseInt(driverIdStr, 10);
    const teamId = entries[0].teamId;
    const types = new Set(entries.map(e => e.sessionType));

    if (types.has('Q1') || types.has('Q2') || types.has('Q3')) {
      const times: Record<string, string | null> = {};
      const byType: Record<string, typeof entries[0]> = {};
      for (const e of entries) {
        byType[e.sessionType] = e;
        times[e.sessionType] = lapTimes.get(String(e.jolpicaId)) ?? null;
      }
      let position: number | null;
      let knockedOutIn: string | null;
      if (byType['Q3']) {
        position = byType['Q3'].position;
        knockedOutIn = null;
      } else if (byType['Q2']) {
        position = byType['Q2'].position;
        knockedOutIn = 'Q2';
      } else {
        position = byType['Q1'].position;
        knockedOutIn = 'Q1';
      }
      records.push({
        raceNumber, driverId, teamId, position,
        q1Time: times['Q1'] ?? null,
        q2Time: times['Q2'] ?? null,
        q3Time: times['Q3'] ?? null,
        qualifyingTime: null,
        knockedOutIn,
      });
    } else {
      const byType: Record<string, typeof entries[0]> = {};
      for (const e of entries) byType[e.sessionType] = e;
      const validTimes = entries
        .map(e => lapTimes.get(String(e.jolpicaId)))
        .filter(Boolean) as string[];
      const bestTime = validTimes.length ? validTimes.sort()[0] : null;
      let position: number | null = null;
      for (const stype of ['QA', 'QO', 'QB']) {
        if (byType[stype]?.position) { position = byType[stype].position; break; }
      }
      if (position == null) {
        const positions = entries.map(e => e.position).filter(p => p != null) as number[];
        position = positions.length ? Math.min(...positions) : null;
      }
      records.push({
        raceNumber, driverId, teamId, position,
        q1Time: null, q2Time: null, q3Time: null,
        qualifyingTime: bestTime,
        knockedOutIn: null,
      });
    }
  }

  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.qualifyingResults).values(records.slice(i, i + CHUNK) as [typeof schema.qualifyingResults.$inferInsert, ...typeof schema.qualifyingResults.$inferInsert[]]);
  }
}

async function buildSprintQualifyingResults(
  db: LibSQLDatabase<typeof schema>,
  client: Client,
  lapTimes: Map<string, string>,
): Promise<void> {
  const rows = await client.execute(`
    SELECT se.id, se.jolpica_id, se.position,
           s.type AS session_type,
           re.race_number, re.driver_id, re.team_id
    FROM session_entries se
    JOIN sessions s ON s.id = se.session_id
    JOIN round_entries re ON re.id = se.round_entry_id
    WHERE s.type IN ('SQ1','SQ2','SQ3')
    ORDER BY re.race_number, re.driver_id, s.type
  `);

  const byDriver = new Map<string, Array<{ jolpicaId: number; position: number | null; sessionType: string; teamId: number }>>();
  for (const row of rows.rows as Record<string, unknown>[]) {
    const key = `${row.race_number}:${row.driver_id}`;
    if (!byDriver.has(key)) byDriver.set(key, []);
    byDriver.get(key)!.push({
      jolpicaId: row.jolpica_id as number,
      position: row.position as number | null,
      sessionType: row.session_type as string,
      teamId: row.team_id as number,
    });
  }

  const records: typeof schema.sprintQualifyingResults.$inferInsert[] = [];
  for (const [key, entries] of byDriver) {
    const [raceNumberStr, driverIdStr] = key.split(':');
    const raceNumber = parseInt(raceNumberStr, 10);
    const driverId = parseInt(driverIdStr, 10);
    const teamId = entries[0].teamId;
    const times: Record<string, string | null> = {};
    const byType: Record<string, typeof entries[0]> = {};
    for (const e of entries) {
      byType[e.sessionType] = e;
      times[e.sessionType] = lapTimes.get(String(e.jolpicaId)) ?? null;
    }
    let position: number | null;
    let knockedOutIn: string | null;
    if (byType['SQ3']) {
      position = byType['SQ3'].position;
      knockedOutIn = null;
    } else if (byType['SQ2']) {
      position = byType['SQ2'].position;
      knockedOutIn = 'SQ2';
    } else {
      position = byType['SQ1'].position;
      knockedOutIn = 'SQ1';
    }
    records.push({
      raceNumber, driverId, teamId, position,
      sq1Time: times['SQ1'] ?? null,
      sq2Time: times['SQ2'] ?? null,
      sq3Time: times['SQ3'] ?? null,
      knockedOutIn,
    });
  }

  for (let i = 0; i < records.length; i += CHUNK) {
    await db.insert(schema.sprintQualifyingResults).values(records.slice(i, i + CHUNK) as [typeof schema.sprintQualifyingResults.$inferInsert, ...typeof schema.sprintQualifyingResults.$inferInsert[]]);
  }
}
