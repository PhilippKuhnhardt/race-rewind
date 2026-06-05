import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getDriverSeasonOverview } from '../../src/lib/queries';
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

async function getDriverId(fullName: string): Promise<number> {
  const result = await handle.client.execute({
    sql: 'SELECT id FROM drivers WHERE full_name = ?',
    args: [fullName],
  });
  return result.rows[0].id as number;
}

async function getRaceNumber(slug: string): Promise<number> {
  const result = await handle.client.execute({
    sql: 'SELECT race_number FROM races WHERE slug = ?',
    args: [slug],
  });
  return result.rows[0].race_number as number;
}

describe('getDriverSeasonOverview', () => {
  it('splits a multi-team season into team-specific stat rows', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const driverId = await getDriverId('Max Verstappen');
    const finalRaceNumber = await getRaceNumber('2016-abu-dhabi-grand-prix');
    const overview = await getDriverSeasonOverview(driverId, finalRaceNumber + 1);
    const rows = overview.filter((row) => row.season === 2016);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.team_name)).toEqual(['Toro Rosso', 'Red Bull']);
    expect(rows[0]).toMatchObject({
      starts: 4,
      wins: 0,
      podiums: 0,
      poles: 0,
      points: 13,
      championship_position: 5,
    });
    expect(rows[1]).toMatchObject({
      starts: 17,
      wins: 1,
      podiums: 7,
      poles: 0,
      points: 191,
      championship_position: 5,
    });
  });

  it('includes the current season to date without including the selected race', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const driverId = await getDriverId('Max Verstappen');
    const spanishRaceNumber = await getRaceNumber('2016-spanish-grand-prix');
    const overview = await getDriverSeasonOverview(driverId, spanishRaceNumber);
    const rows = overview.filter((row) => row.season === 2016);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      team_name: 'Toro Rosso',
      starts: 4,
      wins: 0,
      podiums: 0,
      points: 13,
      championship_position: 10,
    });
  });

  it('sorts seasons chronologically by default', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const driverId = await getDriverId('Max Verstappen');
    const finalRaceNumber = await getRaceNumber('2016-abu-dhabi-grand-prix');
    const seasons = getUniqueSeasons(await getDriverSeasonOverview(driverId, finalRaceNumber + 1));

    expect(seasons).toEqual([2015, 2016]);
  });
});

function getUniqueSeasons(rows: { season: number }[]): number[] {
  return [...new Set(rows.map((row) => row.season))];
}
