import {
  getAllRacesBySeason,
  getRaceBySlug,
  getRaceNumbersWithQualifying,
  getRaceNumbersWithResults,
  getRaceNumbersWithSprintResults,
  getRaceNumbersWithSprintQualifying,
  getSeasonBookends,
  getSessionTabOrderByRace,
} from './queries';
import type { PageContext } from './types';

export type RaceAvailabilityStatus = 'completed' | 'next-unresulted' | 'future';

export interface RaceAvailability {
  status: RaceAvailabilityStatus;
  overviewOnly: boolean;
  hasRaceResults: boolean;
  latestCompletedRaceNumber: number | null;
  latestCompletedRound: number | null;
  latestCompletedName: string | null;
  standingsAsOfRaceNumber: number | null;
  recentFormAsOfRaceNumber: number;
}

export function resolveRaceAvailability({
  raceNumber,
  hasRaceResults,
  latestCompletedRaceNumber,
  latestCompletedRound,
  latestCompletedName,
}: {
  raceNumber: number;
  hasRaceResults: boolean;
  latestCompletedRaceNumber: number | null;
  latestCompletedRound: number | null;
  latestCompletedName: string | null;
}): RaceAvailability {
  const status: RaceAvailabilityStatus = hasRaceResults
    ? 'completed'
    : latestCompletedRaceNumber == null || raceNumber === latestCompletedRaceNumber + 1
      ? 'next-unresulted'
      : 'future';

  return {
    status,
    overviewOnly: status === 'future',
    hasRaceResults,
    latestCompletedRaceNumber,
    latestCompletedRound,
    latestCompletedName,
    standingsAsOfRaceNumber: status === 'future' ? latestCompletedRaceNumber : null,
    recentFormAsOfRaceNumber: status === 'future' && latestCompletedRaceNumber != null
      ? latestCompletedRaceNumber + 1
      : raceNumber,
  };
}

export function getNextUnresultedRaceNumber(
  races: { race_number: number }[],
  raceNumbersWithResults: Set<number>,
): number | null {
  const completed = [...raceNumbersWithResults];
  if (completed.length === 0) {
    return races.reduce<number | null>((min, race) => (
      min == null || race.race_number < min ? race.race_number : min
    ), null);
  }

  const latestCompletedRaceNumber = Math.max(...completed);
  return races
    .map((race) => race.race_number)
    .filter((raceNumber) => raceNumber > latestCompletedRaceNumber)
    .sort((a, b) => a - b)[0] ?? null;
}

export function isCompletedOrNextUnresultedRace(
  raceNumber: number,
  raceNumbersWithResults: Set<number>,
  nextUnresultedRaceNumber: number | null,
): boolean {
  return raceNumbersWithResults.has(raceNumber) || raceNumber === nextUnresultedRaceNumber;
}

export function resolveRaceSessionTabs({
  rawSessionOrder,
  availability,
  hasQualifyingResults,
  hasSprintQualifyingResults,
  hasSprintResults,
}: {
  rawSessionOrder: string[];
  availability: Pick<RaceAvailability, 'status' | 'hasRaceResults'>;
  hasQualifyingResults: boolean;
  hasSprintQualifyingResults: boolean;
  hasSprintResults: boolean;
}): { sessionOrder: string[]; hasGrid: boolean } {
  let sessionOrder = [...rawSessionOrder];

  if (availability.status === 'completed') {
    sessionOrder = sessionOrder.filter((id) => (
      (id !== 'qualifying' || hasQualifyingResults) &&
      (id !== 'sprint-qualifying' || hasSprintQualifyingResults) &&
      (id !== 'sprint' || hasSprintResults)
    ));
  }

  if (availability.status !== 'completed' && hasQualifyingResults && !sessionOrder.includes('qualifying')) {
    const raceIndex = sessionOrder.indexOf('race');
    sessionOrder = raceIndex === -1
      ? [...sessionOrder, 'qualifying']
      : [...sessionOrder.slice(0, raceIndex), 'qualifying', ...sessionOrder.slice(raceIndex)];
  }

  if (availability.status !== 'completed' && hasSprintQualifyingResults && !sessionOrder.includes('sprint-qualifying')) {
    const raceIndex = sessionOrder.indexOf('race');
    sessionOrder = raceIndex === -1
      ? [...sessionOrder, 'sprint-qualifying']
      : [...sessionOrder.slice(0, raceIndex), 'sprint-qualifying', ...sessionOrder.slice(raceIndex)];
  }

  if (availability.hasRaceResults && sessionOrder.length === 0) {
    sessionOrder = ['race'];
  } else if (availability.status === 'next-unresulted' && !sessionOrder.includes('race')) {
    sessionOrder = [...sessionOrder, 'race'];
  }

  return {
    sessionOrder,
    hasGrid: availability.hasRaceResults && !sessionOrder.includes('qualifying'),
  };
}

export async function getRacePageBase(season: string, raceSlug: string) {
  const fullSlug = `${season}-${raceSlug}`;

  const [race, { byseason }, qualiSet, sqSet, sprintSet, raceResultSet, orderMap] = await Promise.all([
    getRaceBySlug(fullSlug),
    getAllRacesBySeason(),
    getRaceNumbersWithQualifying(),
    getRaceNumbersWithSprintQualifying(),
    getRaceNumbersWithSprintResults(),
    getRaceNumbersWithResults(),
    getSessionTabOrderByRace(),
  ]);

  if (!race) return undefined;

  const bookends = await getSeasonBookends(race.season);
  const { raceCount } = bookends;

  const seasonRaces = byseason[race.season] ?? [];
  const idx = seasonRaces.findIndex((r) => r.slug === raceSlug);
  const prevRaceSlug = idx > 0 ? seasonRaces[idx - 1].slug : 'preseason';
  const nextRaceSlug = idx < seasonRaces.length - 1 ? seasonRaces[idx + 1].slug : 'postseason';

  const pageContext: PageContext = {
    kind: 'race',
    season: race.season,
    round: race.round,
    raceCount,
    raceDate: race.date,
    raceName: race.name,
    raceSlug,
    prevRaceSlug,
    nextRaceSlug,
  };

  const hasQuali = qualiSet.has(race.race_number);
  const hasSprintQualifying = sqSet.has(race.race_number);
  const hasSprintResults = sprintSet.has(race.race_number);
  const hasRaceResults = raceResultSet.has(race.race_number);
  const availability = resolveRaceAvailability({
    raceNumber: race.race_number,
    hasRaceResults,
    latestCompletedRaceNumber: bookends.latestCompletedRaceNumber,
    latestCompletedRound: bookends.latestCompletedRound,
    latestCompletedName: bookends.latestCompletedName,
  });
  const { sessionOrder, hasGrid } = resolveRaceSessionTabs({
    rawSessionOrder: orderMap.get(race.race_number) ?? [],
    availability,
    hasQualifyingResults: hasQuali,
    hasSprintQualifyingResults: hasSprintQualifying,
    hasSprintResults,
  });

  return {
    race,
    raceCount,
    prevRaceSlug,
    nextRaceSlug,
    pageContext,
    hasQuali,
    hasSprintQualifying,
    hasGrid,
    sessionOrder,
    availability,
  };
}
