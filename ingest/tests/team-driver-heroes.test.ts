import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { getTeamDriverHeroes } from '../../src/lib/queries';
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

describe('getTeamDriverHeroes', () => {
  it('dedupes metric leaders and fills Ferrari cards with notable drivers', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('ferrari');
    const beforeRaceNumber = await getRaceNumber('2023-miami-grand-prix');
    const heroes = await getTeamDriverHeroes(teamId, beforeRaceNumber);

    expect(heroes.map((hero) => [hero.reason, hero.driver_slug])).toEqual([
      ['most_successful', 'michael-schumacher'],
      ['last_champion', 'kimi-raikkonen'],
      ['notable_driver', 'niki-lauda'],
      ['notable_driver', 'alberto-ascari'],
    ]);
    expect(new Set(heroes.map((hero) => hero.driver_slug)).size).toBe(heroes.length);
    expect(heroes[0]).toMatchObject({
      starts: 181,
      wins: 72,
      driver_championships: 5,
    });
  });

  it('shows available leaders for a team before it has a Drivers Champion', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('red_bull');
    const beforeRaceNumber = await getRaceNumber('2010-bahrain-grand-prix');
    const heroes = await getTeamDriverHeroes(teamId, beforeRaceNumber);

    expect(heroes.map((hero) => [hero.reason, hero.driver_slug])).toEqual([
      ['most_wins', 'sebastian-vettel'],
      ['most_starts', 'david-coulthard'],
      ['notable_driver', 'mark-webber'],
      ['notable_driver', 'christian-klien'],
    ]);
    expect(heroes.every((hero) => hero.driver_championships === 0)).toBe(true);
  });

  it('breaks Most successful championship ties by wins with the team', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('mclaren');
    const beforeRaceNumber = await getRaceNumber('2023-miami-grand-prix');
    const heroes = await getTeamDriverHeroes(teamId, beforeRaceNumber);

    expect(heroes[0]).toMatchObject({
      reason: 'most_successful',
      driver_slug: 'ayrton-senna',
      wins: 35,
      driver_championships: 3,
    });
  });

  it('does not include future championships on preseason pages', async () => {
    const skip = skipIfNoDb(); if (skip || !handle) return;

    const teamId = await getTeamId('red_bull');
    const beforeRaceNumber = await getRaceNumber('2022-bahrain-grand-prix');
    const heroes = await getTeamDriverHeroes(teamId, beforeRaceNumber);
    const verstappen = heroes.find((hero) => hero.driver_slug === 'max-verstappen');

    expect(verstappen).toMatchObject({
      reason: 'last_champion',
      driver_championships: 1,
      last_championship_season: 2021,
    });
  });
});
