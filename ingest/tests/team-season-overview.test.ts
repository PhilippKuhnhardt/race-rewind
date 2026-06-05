import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getTeamSeasonOverview } from '../../src/lib/queries';
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

async function getTeamId(slug: string): Promise<number> {
  const result = await handle.client.execute({
    sql: 'SELECT id FROM teams WHERE slug = ?',
    args: [slug],
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

describe('getTeamSeasonOverview', () => {
  it('counts team Grand Prix appearances once, not once per car', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('ferrari');
    const brazilRaceNumber = await getRaceNumber('2000-brazilian-grand-prix');
    const overview = await getTeamSeasonOverview(teamId, brazilRaceNumber);
    const row = overview.find((row) => row.season === 2000);

    expect(row).toMatchObject({
      grand_prix: 1,
      wins: 1,
      podiums: 1,
      points: 16,
      championship_position: 1,
    });
  });

  it('includes the current season to date without including the selected race', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('red_bull');
    const miamiRaceNumber = await getRaceNumber('2023-miami-grand-prix');
    const overview = await getTeamSeasonOverview(teamId, miamiRaceNumber);
    const row = overview.find((row) => row.season === 2023);

    expect(row).toMatchObject({
      grand_prix: 4,
      wins: 4,
      podiums: 4,
      poles: 3,
      points: 180,
      championship_position: 1,
    });
  });

  it('excludes the upcoming season on preseason pages', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('red_bull');
    const bahrainRaceNumber = await getRaceNumber('2023-bahrain-grand-prix');
    const seasons = (await getTeamSeasonOverview(teamId, bahrainRaceNumber)).map((row) => row.season);

    expect(seasons).not.toContain(2023);
    expect(seasons.at(-1)).toBe(2022);
  });
});
