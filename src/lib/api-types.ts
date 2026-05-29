export interface DriverAtRacePayload {
  driver: {
    slug: string;
    full_name: string;
    abbreviation: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    permanent_car_number: number | null;
  };
  race: {
    slug: string;
    season: number;
    round: number;
    name: string;
    date: string;
    race_number: number;
  };
  team_at_race: {
    slug: string;
    name: string;
  } | null;
  standing_going_in: {
    position: number | null;
    points: number;
    win_count: number;
  } | null;
  career_going_in: {
    starts: number;
    wins: number;
    podiums: number;
    poles: number;
    fastest_laps: number;
    points: number;
    championships: number;
  };
  result_this_race: {
    grid: number | null;
    position: number | null;
    status: number | null;
    detail: string | null;
    time: string | null;
    points: number | null;
    is_classified: number | null;
    fastest_lap_rank: number | null;
  } | null;
}

export interface DriverPickerEntry {
  slug: string;
  full_name: string;
  nationality: string | null;
}

export interface RacePickerEntry {
  slug: string;
  season: number;
  name: string;
}
