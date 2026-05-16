export type PageContext =
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
      kind: 'driver-race';
      season: number;
      raceName: string;
      raceSlug: string;
      driverName: string;
      driverSlug: string;
    }
  | {
      kind: 'team-race';
      season: number;
      raceName: string;
      raceSlug: string;
      teamName: string;
      teamSlug: string;
    };
