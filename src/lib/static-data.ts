import type { DriverAtRacePayload, DriverPickerEntry } from './api-types';
import type {
  DriverSeasonOverviewRow,
  DriverTeamRecord,
} from './queries/drivers';
import type {
  TeamDriverHeroRecord,
  TeamDriverRecord,
  TeamSeasonOverviewRow,
} from './queries/teams';

export interface StaticRaceEntry {
  slug: string;
  name: string;
  race_number: number;
  round: number;
  date: string;
}

export interface StaticSeasonEntry {
  season: number;
  first_race_number: number;
  first_race_slug: string;
  last_race_number: number;
  last_race_slug: string;
  races: StaticRaceEntry[];
}

export interface StaticTimeline {
  seasons: number[];
  byseason: Record<string, StaticRaceEntry[]>;
  season_bounds: Record<string, StaticSeasonEntry>;
  latest: { season: number; race_slug: string };
}

export interface StaticSnapshotRef {
  after: number;
  path: string;
}

export interface StaticDriverMeta extends DriverPickerEntry {
  abbreviation: string | null;
  date_of_birth: string | null;
  permanent_car_number: number | null;
  snapshots: StaticSnapshotRef[];
}

export interface StaticTeamMeta {
  slug: string;
  name: string;
  nationality: string | null;
  country_code: string | null;
  snapshots: StaticSnapshotRef[];
}

export interface StaticDriverIndex {
  drivers: StaticDriverMeta[];
}

export interface StaticTeamIndex {
  teams: StaticTeamMeta[];
}

export interface StaticDriverSnapshot {
  kind: 'driver';
  driver: Omit<StaticDriverMeta, 'snapshots'>;
  visible_after_race_number: number;
  career_going_in: DriverAtRacePayload['career_going_in'];
  prior_seasons: number;
  season_overview: DriverSeasonOverviewRow[];
  teams_driven: DriverTeamRecord[];
}

export interface StaticTeamSnapshot {
  kind: 'team';
  team: Omit<StaticTeamMeta, 'snapshots'>;
  visible_after_race_number: number;
  career_going_in: {
    entries: number;
    wins: number;
    podiums: number;
    poles: number;
    fastest_laps: number;
    points: number;
    championships: number;
    drivers_fielded: number;
  };
  driver_heroes: TeamDriverHeroRecord[];
  season_overview: TeamSeasonOverviewRow[];
  drivers_fielded: TeamDriverRecord[];
}

export type StaticEntitySnapshot = StaticDriverSnapshot | StaticTeamSnapshot;
