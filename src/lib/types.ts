export type PageContext =
  | {
      kind: 'preseason';
      season: number;
      raceCount: number;
      firstRaceSlug: string;
    }
  | {
      kind: 'race';
      season: number;
      round: number;
      raceCount: number;
      raceDate: string;
      raceName: string;
      raceSlug: string;
      prevRaceSlug?: string;
      nextRaceSlug?: string;
    }
  | {
      kind: 'postseason';
      season: number;
      raceCount: number;
      /** Latest completed race slug (in-progress) or last race slug (complete). Back-arrow target. */
      prevRaceSlug: string;
      /** Round number shown when in-progress; null when complete or no data. */
      inProgressRound: number | null;
    }
  | {
      kind: 'driver-race';
      season: number;
      raceName: string;
      raceSlug: string;
      driverName: string;
      driverSlug: string;
      prevRaceSlug?: string;
      nextRaceSlug?: string;
    }
  | {
      kind: 'team-race';
      season: number;
      raceName: string;
      raceSlug: string;
      teamName: string;
      teamSlug: string;
      prevRaceSlug?: string;
      nextRaceSlug?: string;
    };
