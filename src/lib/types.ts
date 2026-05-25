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
    }
  | {
      kind: 'stats';
      season: number;
      raceCount: number;
      chainSlug: string;
      raceName: string | null;
      prevChainSlug?: string;
      nextChainSlug?: string;
    }
  | {
      kind: 'driver-preseason';
      season: number;
      raceCount: number;
      driverName: string;
      driverSlug: string;
      nextRaceSlug: string;
    }
  | {
      kind: 'driver-postseason';
      season: number;
      raceCount: number;
      driverName: string;
      driverSlug: string;
      prevRaceSlug: string;
    }
  | {
      kind: 'team-preseason';
      season: number;
      raceCount: number;
      teamName: string;
      teamSlug: string;
      nextRaceSlug: string;
    }
  | {
      kind: 'team-postseason';
      season: number;
      raceCount: number;
      teamName: string;
      teamSlug: string;
      prevRaceSlug: string;
    }
  | {
      kind: 'season';
      season: number;
      raceCount: number;
      chainSlug: string;
      prevChainSlug?: string;
      nextChainSlug?: string;
    }
  | {
      kind: 'compare-race';
      season: number;
      raceName: string;
      raceSlug: string;
      driverAName: string;
      driverASlug: string;
      driverBName: string;
      driverBSlug: string;
      prevRaceSlug?: string;
      nextRaceSlug?: string;
    };
