export type PointInTime =
  | { kind: 'preseason'; season: number }
  | { kind: 'race'; season: number; raceSlug: string; raceNumber: number }
  | { kind: 'postseason'; season: number };

export function pitForPreseason(season: number): PointInTime {
  return { kind: 'preseason', season };
}

export function pitForPostseason(season: number): PointInTime {
  return { kind: 'postseason', season };
}

export function pitForRace(race: { season: number; slug: string; race_number: number }, raceNavSlug: string): PointInTime {
  return { kind: 'race', season: race.season, raceSlug: raceNavSlug, raceNumber: race.race_number };
}

/** Race number to pass as `beforeRaceNumber` to career-stats queries (strictly-less-than semantics). */
export function resolveAsOfRaceNumber(
  pit: PointInTime,
  bookends: { firstRaceNumber: number; lastRaceNumber: number },
): number {
  if (pit.kind === 'preseason') return bookends.firstRaceNumber;
  if (pit.kind === 'race') return pit.raceNumber;
  return bookends.lastRaceNumber + 1;
}
