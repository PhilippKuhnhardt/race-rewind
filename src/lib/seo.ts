type RaceSeoInput = {
  season: number;
  name: string;
  round: number;
  circuit_name: string;
  circuit_locality: string | null;
};

function raceLocation(race: Pick<RaceSeoInput, 'circuit_name' | 'circuit_locality'>): string {
  return race.circuit_locality
    ? `${race.circuit_name}, ${race.circuit_locality}`
    : race.circuit_name;
}

export function raceOverviewSeo(race: RaceSeoInput): { title: string; description: string } {
  return {
    title: `${race.season} F1 ${race.name} - Preview, Standings & Race Weekend`,
    description: `Explore the ${race.season} F1 ${race.name} at ${raceLocation(race)} before the race: round ${race.round} standings, form, and race-weekend context.`,
  };
}

export function raceSessionSeo(
  race: RaceSeoInput,
  session:
    | 'Race Results'
    | 'Qualifying'
    | 'Starting Grid'
    | 'Sprint'
    | 'Sprint Qualifying'
    | 'Drivers'
    | 'Teams'
    | 'Standings'
): { title: string; description: string } {
  const location = raceLocation(race);
  const prefix = `${race.season} F1 ${race.name}`;

  switch (session) {
    case 'Race Results':
      return {
        title: `${prefix} Results`,
        description: `${prefix} race results at ${location}: classified finishers, gaps, grid positions, and points.`,
      };
    case 'Qualifying':
      return {
        title: `${prefix} Qualifying Results`,
        description: `${prefix} qualifying results at ${location}: lap times, positions, drivers, and teams.`,
      };
    case 'Starting Grid':
      return {
        title: `${prefix} Starting Grid`,
        description: `${prefix} starting grid at ${location}: grid order, drivers, teams, and race numbers.`,
      };
    case 'Sprint':
      return {
        title: `${prefix} Sprint Results`,
        description: `${prefix} sprint results at ${location}: classified finishers, gaps, grid positions, and points.`,
      };
    case 'Sprint Qualifying':
      return {
        title: `${prefix} Sprint Qualifying Results`,
        description: `${prefix} sprint qualifying results at ${location}: lap times, positions, drivers, and teams.`,
      };
    case 'Drivers':
      return {
        title: `${prefix} Driver Standings Before the Race`,
        description: `${prefix} driver championship standings before round ${race.round}, fixed to the race weekend.`,
      };
    case 'Teams':
      return {
        title: `${prefix} Constructor Standings Before the Race`,
        description: `${prefix} constructor championship standings before round ${race.round}, fixed to the race weekend.`,
      };
    case 'Standings':
      return {
        title: `${prefix} Championship Standings After the Race`,
        description: `${prefix} driver and constructor championship standings after round ${race.round}.`,
      };
  }
}

export function preseasonSeo(season: number): { title: string; description: string } {
  return {
    title: `${season} F1 Season Preview - Start of Season - Preseason`,
    description: `Explore the ${season} F1 preseason: starting grid, race calendar, driver career stats, and team context.`,
  };
}
