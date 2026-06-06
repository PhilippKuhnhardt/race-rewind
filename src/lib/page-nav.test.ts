import { describe, expect, it } from 'vitest';
import { resolvePageNavState } from './page-nav';
import type { PageContext } from './types';

const latest = { season: 2026, slug: '2026-canadian-grand-prix' };

describe('resolvePageNavState', () => {
  it('keeps driver postseason pages at postseason instead of latest race', () => {
    const pageContext: PageContext = {
      kind: 'driver-postseason',
      season: 1984,
      raceCount: 16,
      driverName: 'Niki Lauda',
      driverSlug: 'niki-lauda',
      prevRaceSlug: 'portuguese-grand-prix',
    };

    expect(resolvePageNavState(pageContext, latest)).toEqual({
      currentSeason: 1984,
      currentRaceSlug: 'portuguese-grand-prix',
      currentChainSlug: 'postseason',
      compareSlug: 'postseason',
      section: 'seasons',
    });
  });

  it('keeps driver preseason pages at preseason', () => {
    const pageContext: PageContext = {
      kind: 'driver-preseason',
      season: 1984,
      raceCount: 16,
      driverName: 'Niki Lauda',
      driverSlug: 'niki-lauda',
      nextRaceSlug: 'brazilian-grand-prix',
    };

    expect(resolvePageNavState(pageContext, latest)).toMatchObject({
      currentSeason: 1984,
      currentRaceSlug: 'brazilian-grand-prix',
      currentChainSlug: 'preseason',
      compareSlug: 'preseason',
    });
  });

  it('keeps team boundary pages at their point in time', () => {
    const pageContext: PageContext = {
      kind: 'team-postseason',
      season: 1991,
      raceCount: 16,
      teamName: 'McLaren',
      teamSlug: 'mclaren',
      prevRaceSlug: 'australian-grand-prix',
    };

    expect(resolvePageNavState(pageContext, latest)).toMatchObject({
      currentSeason: 1991,
      currentChainSlug: 'postseason',
      compareSlug: 'postseason',
    });
  });

  it('uses the latest race only when no page context exists', () => {
    expect(resolvePageNavState(undefined, latest)).toEqual({
      currentSeason: 2026,
      currentRaceSlug: 'canadian-grand-prix',
      currentChainSlug: 'canadian-grand-prix',
      compareSlug: 'canadian-grand-prix',
      section: 'seasons',
    });
  });
});
