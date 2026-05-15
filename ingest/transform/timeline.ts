import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { readCsv, asInt, asBool } from '../csv';
import { raceSlug, deduplicate } from '../slugs';
import type { IngestState } from '../state';
import * as schema from '../../src/db/schema';

const CHUNK = 500;

export async function loadTimeline(
  db: LibSQLDatabase<typeof schema>,
  dumpDir: string,
  state: IngestState,
): Promise<void> {
  const { seasonMap } = { seasonMap: state.seasons };

  // Index sessions by round_id
  const sessionsByRound = new Map<string, Record<string, string>[]>();
  for (const s of readCsv(dumpDir, 'formula_one_session.csv')) {
    const rid = s.round_id;
    if (!rid) continue;
    if (!sessionsByRound.has(rid)) sessionsByRound.set(rid, []);
    sessionsByRound.get(rid)!.push(s);
  }

  // Build races
  const existingSlugs = new Set<string>();
  const raceRows: typeof schema.races.$inferInsert[] = [];
  const raceNumberByJolpicaRound = new Map<string, number>();

  for (const r of readCsv(dumpDir, 'formula_one_round.csv')) {
    if (!r.race_number) continue;  // cancelled round
    const jolpicaRoundId = r.id;
    const year = seasonMap.get(parseInt(r.season_id, 10))!;
    const base = raceSlug(year, r.name);
    const slug = deduplicate(base, existingSlugs);
    existingSlugs.add(slug);

    const sessions = sessionsByRound.get(jolpicaRoundId) ?? [];
    const raceSession = sessions.find(s => s.type === 'R');
    const date = (raceSession?.timestamp?.slice(0, 10)) || r.date;
    const hasSprint = sessions.some(s => s.type === 'SR') ? 1 : 0;

    const raceNumber = parseInt(r.race_number, 10);
    raceNumberByJolpicaRound.set(jolpicaRoundId, raceNumber);
    raceRows.push({
      raceNumber,
      slug,
      jolpicaId: parseInt(r.id, 10),
      jolpicaApiId: r.api_id,
      season: year,
      round: asInt(r, 'number') ?? 0,
      circuitId: state.circuits.get(parseInt(r.circuit_id, 10))!,
      name: r.name,
      date,
      hasSprint,
      wikipedia: r.wikipedia || null,
    });
  }

  for (let i = 0; i < raceRows.length; i += CHUNK) {
    await db.insert(schema.races).values(raceRows.slice(i, i + CHUNK) as [typeof schema.races.$inferInsert, ...typeof schema.races.$inferInsert[]]);
  }

  state.raceNumberByRoundJolpicaId = raceNumberByJolpicaRound;

  // Build sessions
  const sessionRows: typeof schema.sessions.$inferInsert[] = [];
  for (const [rid, sessList] of sessionsByRound) {
    const raceNumber = raceNumberByJolpicaRound.get(rid);
    if (raceNumber == null) continue;  // cancelled round
    for (const s of sessList) {
      sessionRows.push({
        jolpicaId: parseInt(s.id, 10),
        jolpicaApiId: s.api_id,
        raceNumber,
        type: s.type,
        number: asInt(s, 'number'),
        pointSystemId: asInt(s, 'point_system_id'),
        scheduledLaps: asInt(s, 'scheduled_laps'),
        timestamp: s.timestamp || null,
        timezone: s.timezone || null,
        hasTimeData: asBool(s, 'has_time_data'),
        isCancelled: asBool(s, 'is_cancelled'),
      });
    }
  }
  for (let i = 0; i < sessionRows.length; i += CHUNK) {
    await db.insert(schema.sessions).values(sessionRows.slice(i, i + CHUNK) as [typeof schema.sessions.$inferInsert, ...typeof schema.sessions.$inferInsert[]]);
  }
}
