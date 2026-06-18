import { describe, expect, it } from 'vitest';
import { raceSubNavItems } from './race-subnav';
import {
  getNextUnresultedRaceNumber,
  isCompletedOrNextUnresultedRace,
  resolveRaceAvailability,
  resolveRaceSessionTabs,
} from './race-page';

describe('resolveRaceAvailability', () => {
  it('keeps completed races fully available', () => {
    expect(resolveRaceAvailability({
      raceNumber: 1156,
      hasRaceResults: true,
      latestCompletedRaceNumber: 1156,
      latestCompletedRound: 7,
      latestCompletedName: 'Barcelona Grand Prix',
    })).toMatchObject({
      status: 'completed',
      overviewOnly: false,
      hasRaceResults: true,
      standingsAsOfRaceNumber: null,
      recentFormAsOfRaceNumber: 1156,
    });
  });

  it('treats the first unresulted race as the next race', () => {
    expect(resolveRaceAvailability({
      raceNumber: 1157,
      hasRaceResults: false,
      latestCompletedRaceNumber: 1156,
      latestCompletedRound: 7,
      latestCompletedName: 'Barcelona Grand Prix',
    })).toMatchObject({
      status: 'next-unresulted',
      overviewOnly: false,
      standingsAsOfRaceNumber: null,
      recentFormAsOfRaceNumber: 1157,
    });
  });

  it('pins later future races to the latest completed standings', () => {
    expect(resolveRaceAvailability({
      raceNumber: 1158,
      hasRaceResults: false,
      latestCompletedRaceNumber: 1156,
      latestCompletedRound: 7,
      latestCompletedName: 'Barcelona Grand Prix',
    })).toMatchObject({
      status: 'future',
      overviewOnly: true,
      standingsAsOfRaceNumber: 1156,
      recentFormAsOfRaceNumber: 1157,
    });
  });
});

describe('current race routing helpers', () => {
  const races = [
    { race_number: 1156 },
    { race_number: 1157 },
    { race_number: 1158 },
  ];
  const resultSet = new Set([1156]);

  it('finds the first race after the latest completed race', () => {
    expect(getNextUnresultedRaceNumber(races, resultSet)).toBe(1157);
  });

  it('allows completed races and the current unresulted race only', () => {
    const next = getNextUnresultedRaceNumber(races, resultSet);

    expect(isCompletedOrNextUnresultedRace(1156, resultSet, next)).toBe(true);
    expect(isCompletedOrNextUnresultedRace(1157, resultSet, next)).toBe(true);
    expect(isCompletedOrNextUnresultedRace(1158, resultSet, next)).toBe(false);
  });
});

describe('raceSubNavItems', () => {
  it('shows only overview for future races beyond the next one', () => {
    expect(raceSubNavItems(2026, 'british-grand-prix', ['qualifying', 'race'], false, true))
      .toEqual([{ id: 'overview', label: 'Overview', href: '/seasons/2026/british-grand-prix/' }]);
  });

  it('does not show after-race standings before race results exist', () => {
    expect(raceSubNavItems(2026, 'austrian-grand-prix', ['qualifying'], false, false, false)
      .map((item) => item.id))
      .toEqual(['overview', 'qualifying']);
  });

  it('shows scheduled qualifying instead of grid when qualifying results have not arrived', () => {
    expect(raceSubNavItems(2026, 'austrian-grand-prix', ['qualifying', 'race'], false, false, false)
      .map((item) => item.id))
      .toEqual(['overview', 'qualifying', 'race']);
  });

  it('shows grid for completed races without qualifying data', () => {
    expect(raceSubNavItems(1971, 'canadian-grand-prix', ['race'], true)
      .map((item) => item.id))
      .toEqual(['overview', 'grid', 'race', 'standings']);
  });
});

describe('resolveRaceSessionTabs', () => {
  it('uses grid for completed old races with session metadata but no qualifying rows', () => {
    expect(resolveRaceSessionTabs({
      rawSessionOrder: ['qualifying', 'race'],
      availability: { status: 'completed', hasRaceResults: true },
      hasQualifyingResults: false,
      hasSprintQualifyingResults: false,
      hasSprintResults: false,
    })).toEqual({
      sessionOrder: ['race'],
      hasGrid: true,
    });
  });

  it('keeps scheduled qualifying for the current unresulted race even before result rows arrive', () => {
    expect(resolveRaceSessionTabs({
      rawSessionOrder: ['qualifying', 'race'],
      availability: { status: 'next-unresulted', hasRaceResults: false },
      hasQualifyingResults: false,
      hasSprintQualifyingResults: false,
      hasSprintResults: false,
    })).toEqual({
      sessionOrder: ['qualifying', 'race'],
      hasGrid: false,
    });
  });
});
