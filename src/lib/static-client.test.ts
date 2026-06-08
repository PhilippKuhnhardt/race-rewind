import { describe, expect, it } from 'vitest';
import {
  compareDriversHref,
  comparePickerHref,
  driverHref,
  parseStaticQuery,
  resolvePit,
  teamHref,
} from './static-client';
import type { StaticTimeline } from './static-data';

const timeline: StaticTimeline = {
  seasons: [2021],
  byseason: {
    '2021': [
      {
        slug: 'bahrain-grand-prix',
        name: 'Bahrain Grand Prix',
        race_number: 1001,
        round: 1,
        date: '2021-03-28',
      },
      {
        slug: 'british-grand-prix',
        name: 'British Grand Prix',
        race_number: 1010,
        round: 10,
        date: '2021-07-18',
      },
    ],
  },
  season_bounds: {
    '2021': {
      season: 2021,
      first_race_number: 1001,
      first_race_slug: 'bahrain-grand-prix',
      last_race_number: 1010,
      last_race_slug: 'british-grand-prix',
      races: [
        {
          slug: 'bahrain-grand-prix',
          name: 'Bahrain Grand Prix',
          race_number: 1001,
          round: 1,
          date: '2021-03-28',
        },
        {
          slug: 'british-grand-prix',
          name: 'British Grand Prix',
          race_number: 1010,
          round: 10,
          date: '2021-07-18',
        },
      ],
    },
  },
  latest: { season: 2021, race_slug: 'british-grand-prix' },
};

describe('parseStaticQuery', () => {
  it('parses driver query URLs', () => {
    expect(parseStaticQuery('drivers', '?slug=lewis-hamilton&season=2021&chain=british-grand-prix')).toEqual({
      kind: 'driver',
      slug: 'lewis-hamilton',
      season: 2021,
      chain: 'british-grand-prix',
    });
  });

  it('parses team query URLs', () => {
    expect(parseStaticQuery('teams', '?slug=mercedes&season=2021&chain=preseason')).toEqual({
      kind: 'team',
      slug: 'mercedes',
      season: 2021,
      chain: 'preseason',
    });
  });

  it('parses compare picker and result query URLs', () => {
    expect(parseStaticQuery('compare', '?season=2021&chain=postseason&prefill=max-verstappen')).toEqual({
      kind: 'compare-picker',
      season: 2021,
      chain: 'postseason',
      prefill: 'max-verstappen',
    });

    expect(
      parseStaticQuery(
        'compare',
        '?driverA=lewis-hamilton&driverB=max-verstappen&season=2021&chain=british-grand-prix',
      ),
    ).toEqual({
      kind: 'compare-drivers',
      driverA: 'lewis-hamilton',
      driverB: 'max-verstappen',
      season: 2021,
      chain: 'british-grand-prix',
    });
  });

  it('rejects missing or incomplete required params', () => {
    expect(parseStaticQuery('drivers', '?season=2021&chain=british-grand-prix')).toBeNull();
    expect(parseStaticQuery('teams', '?slug=mercedes&chain=british-grand-prix')).toBeNull();
    expect(parseStaticQuery('compare', '?driverA=lewis-hamilton&season=2021&chain=british-grand-prix')).toBeNull();
    expect(parseStaticQuery('compare', '?season=abc&chain=british-grand-prix')).toBeNull();
  });
});

describe('static href builders', () => {
  it('builds canonical static section query URLs', () => {
    const pit = { season: 2021, chain: 'british-grand-prix' };

    expect(driverHref('lewis-hamilton', pit)).toBe(
      '/drivers/?slug=lewis-hamilton&season=2021&chain=british-grand-prix',
    );
    expect(teamHref('mercedes', pit)).toBe('/teams/?slug=mercedes&season=2021&chain=british-grand-prix');
    expect(comparePickerHref(pit)).toBe('/compare/?season=2021&chain=british-grand-prix');
    expect(comparePickerHref(pit, { prefill: 'lewis-hamilton' })).toBe(
      '/compare/?season=2021&chain=british-grand-prix&prefill=lewis-hamilton',
    );
    expect(compareDriversHref('lewis-hamilton', 'max-verstappen', pit)).toBe(
      '/compare/?driverA=lewis-hamilton&driverB=max-verstappen&season=2021&chain=british-grand-prix',
    );
  });
});

describe('resolvePit', () => {
  it('resolves preseason, race, and postseason chains', () => {
    expect(resolvePit(timeline, 2021, 'preseason')).toMatchObject({
      season: 2021,
      chain: 'preseason',
      visibleAfterRaceNumber: 1000,
      nextChain: 'bahrain-grand-prix',
    });

    expect(resolvePit(timeline, 2021, 'british-grand-prix')).toMatchObject({
      season: 2021,
      chain: 'british-grand-prix',
      visibleAfterRaceNumber: 1009,
      prevChain: 'bahrain-grand-prix',
      nextChain: 'postseason',
    });

    expect(resolvePit(timeline, 2021, 'postseason')).toMatchObject({
      season: 2021,
      chain: 'postseason',
      visibleAfterRaceNumber: 1010,
      prevChain: 'british-grand-prix',
    });
  });
});
