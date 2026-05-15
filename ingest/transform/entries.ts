import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { readCsv, asInt, asFloat, asBool } from '../csv';
import type { IngestState } from '../state';
import * as schema from '../../src/db/schema';

const CHUNK = 1000;

export async function loadEntries(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
  state: IngestState,
): Promise<void> {
  const { drivers: driverMap, teams: teamMap, raceNumberByRoundJolpicaId } = state;

  // Build teamdriver_id → {driver_id, team_id}
  const tdMap = new Map<string, { driverId: number; teamId: number }>();
  for (const r of readCsv(dumpDir, 'formula_one_teamdriver.csv')) {
    const driverId = driverMap.get(parseInt(r.driver_id, 10));
    const teamId = teamMap.get(parseInt(r.team_id, 10));
    if (driverId == null || teamId == null) continue;
    tdMap.set(r.id, { driverId, teamId });
  }

  // round_entries
  const reRows: typeof schema.roundEntries.$inferInsert[] = [];
  for (const r of readCsv(dumpDir, 'formula_one_roundentry.csv')) {
    const raceNumber = raceNumberByRoundJolpicaId.get(r.round_id);
    if (raceNumber == null) continue;  // cancelled round
    const td = tdMap.get(r.team_driver_id);
    if (!td) continue;
    // Keep ALL rows including shared-drive duplicates so session_entries FKs remain valid
    reRows.push({
      jolpicaId: parseInt(r.id, 10),
      jolpicaApiId: r.api_id,
      raceNumber,
      driverId: td.driverId,
      teamId: td.teamId,
      carNumber: asInt(r, 'car_number'),
    });
  }
  for (let i = 0; i < reRows.length; i += CHUNK) {
    await db.insert(schema.roundEntries).values(reRows.slice(i, i + CHUNK) as [typeof schema.roundEntries.$inferInsert, ...typeof schema.roundEntries.$inferInsert[]]);
  }

  // Build jolpica_id → internal_id maps
  const reInserted = await db
    .select({ id: schema.roundEntries.id, jolpicaId: schema.roundEntries.jolpicaId })
    .from(schema.roundEntries);
  state.reInternalMap = new Map(reInserted.map(r => [r.jolpicaId, r.id]));

  const sessInserted = await db
    .select({ id: schema.sessions.id, jolpicaId: schema.sessions.jolpicaId })
    .from(schema.sessions);
  state.sessionInternalMap = new Map(sessInserted.map(r => [r.jolpicaId, r.id]));

  // session_entries
  const seRows: typeof schema.sessionEntries.$inferInsert[] = [];
  for (const r of readCsv(dumpDir, 'formula_one_sessionentry.csv')) {
    const sessionId = state.sessionInternalMap.get(parseInt(r.session_id, 10));
    const roundEntryId = state.reInternalMap.get(parseInt(r.round_entry_id, 10));
    if (sessionId == null || roundEntryId == null) continue;  // cancelled round
    seRows.push({
      jolpicaId: parseInt(r.id, 10),
      jolpicaApiId: r.api_id,
      sessionId,
      roundEntryId,
      grid: asInt(r, 'grid'),
      position: asInt(r, 'position'),
      lapsCompleted: asInt(r, 'laps_completed'),
      status: asInt(r, 'status'),
      detail: r.detail || null,
      time: r.time || null,
      points: asFloat(r, 'points'),
      isClassified: asBool(r, 'is_classified'),
      isEligibleForPoints: asBool(r, 'is_eligible_for_points'),
      fastestLapRank: asInt(r, 'fastest_lap_rank'),
    });
  }
  for (let i = 0; i < seRows.length; i += CHUNK) {
    await db.insert(schema.sessionEntries).values(seRows.slice(i, i + CHUNK) as [typeof schema.sessionEntries.$inferInsert, ...typeof schema.sessionEntries.$inferInsert[]]);
  }
}
