import type {
  StaticDriverIndex,
  StaticDriverMeta,
  StaticDriverSnapshot,
  StaticRaceEntry,
  StaticSnapshotRef,
  StaticTeamIndex,
  StaticTeamMeta,
  StaticTeamSnapshot,
  StaticTimeline,
} from './static-data';

export type StaticSection = 'drivers' | 'teams' | 'compare';

export type StaticDriverRoute = { kind: 'driver'; slug: string; season: number; chain: string };
export type StaticTeamRoute = { kind: 'team'; slug: string; season: number; chain: string };
export type StaticComparePickerRoute = {
  kind: 'compare-picker';
  season: number;
  chain: string;
  prefill?: string;
};
export type StaticCompareDriversRoute = {
  kind: 'compare-drivers';
  driverA: string;
  driverB: string;
  season: number;
  chain: string;
};

export type StaticEntityRoute =
  | StaticDriverRoute
  | StaticTeamRoute
  | StaticComparePickerRoute
  | StaticCompareDriversRoute;

export type StaticLoadedState =
  | {
      route: StaticDriverRoute;
      pit: StaticPit;
      timeline: StaticTimeline;
      meta: StaticDriverMeta;
      snapshot: StaticDriverSnapshot;
    }
  | {
      route: StaticTeamRoute;
      pit: StaticPit;
      timeline: StaticTimeline;
      meta: StaticTeamMeta;
      snapshot: StaticTeamSnapshot;
    }
  | {
      route: StaticComparePickerRoute;
      pit: StaticPit;
      timeline: StaticTimeline;
      driverIndex: StaticDriverIndex;
    }
  | {
      route: StaticCompareDriversRoute;
      pit: StaticPit;
      timeline: StaticTimeline;
      driverIndex: StaticDriverIndex;
      driverA: StaticDriverMeta;
      driverB: StaticDriverMeta;
      snapshotA: StaticDriverSnapshot;
      snapshotB: StaticDriverSnapshot;
    };

export const compareStatRows = [
  { label: 'Starts', key: 'starts' },
  { label: 'Wins', key: 'wins' },
  { label: 'Podiums', key: 'podiums' },
  { label: 'Poles', key: 'poles' },
  { label: 'Fastest Laps', key: 'fastest_laps' },
  { label: 'Career Points', key: 'points' },
  { label: 'Championships', key: 'championships' },
] as const;

export interface StaticPit {
  season: number;
  chain: string;
  race: StaticRaceEntry | null;
  raceCount: number;
  visibleAfterRaceNumber: number;
  prevChain?: string;
  nextChain?: string;
  label: string;
  subtitle: string;
}

function requiredParam(params: URLSearchParams, name: string): string | null {
  const value = params.get(name)?.trim();
  return value ? value : null;
}

function parseSeason(value: string | null): number | null {
  if (!value) return null;
  const season = Number(value);
  return Number.isInteger(season) && season > 0 ? season : null;
}

export function parseStaticQuery(section: StaticSection, search: string): StaticEntityRoute | null {
  const params = new URLSearchParams(search);
  const season = parseSeason(params.get('season'));
  const chain = requiredParam(params, 'chain');
  if (season == null || !chain) return null;

  if (section === 'drivers') {
    const slug = requiredParam(params, 'slug');
    return slug ? { kind: 'driver', slug, season, chain } : null;
  }

  if (section === 'teams') {
    const slug = requiredParam(params, 'slug');
    return slug ? { kind: 'team', slug, season, chain } : null;
  }

  const driverA = requiredParam(params, 'driverA');
  const driverB = requiredParam(params, 'driverB');
  if (driverA || driverB) {
    return driverA && driverB ? { kind: 'compare-drivers', driverA, driverB, season, chain } : null;
  }

  return {
    kind: 'compare-picker',
    season,
    chain,
    prefill: requiredParam(params, 'prefill') ?? undefined,
  };
}

function sectionHref(pathname: string, entries: [string, string | number | undefined][]): string {
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value != null && value !== '') params.set(key, String(value));
  }
  return `${pathname}?${params.toString()}`;
}

export function driverHref(slug: string, pit: Pick<StaticPit, 'season' | 'chain'>): string {
  return sectionHref('/drivers/', [
    ['slug', slug],
    ['season', pit.season],
    ['chain', pit.chain],
  ]);
}

export function teamHref(slug: string, pit: Pick<StaticPit, 'season' | 'chain'>): string {
  return sectionHref('/teams/', [
    ['slug', slug],
    ['season', pit.season],
    ['chain', pit.chain],
  ]);
}

export function comparePickerHref(
  pit: Pick<StaticPit, 'season' | 'chain'>,
  opts?: { prefill?: string },
): string {
  return sectionHref('/compare/', [
    ['season', pit.season],
    ['chain', pit.chain],
    ['prefill', opts?.prefill],
  ]);
}

export function compareDriversHref(
  driverA: string,
  driverB: string,
  pit: Pick<StaticPit, 'season' | 'chain'>,
): string {
  return sectionHref('/compare/', [
    ['driverA', driverA],
    ['driverB', driverB],
    ['season', pit.season],
    ['chain', pit.chain],
  ]);
}

export function raceHref(pit: Pick<StaticPit, 'season' | 'chain'>): string {
  return `/seasons/${pit.season}/${pit.chain}/`;
}

export function resolvePit(timeline: StaticTimeline, season: number, chain: string): StaticPit | null {
  const bounds = timeline.season_bounds[String(season)];
  if (!bounds) return null;

  const races = timeline.byseason[String(season)] ?? [];
  const raceCount = races.length;

  if (chain === 'preseason') {
    return {
      season,
      chain,
      race: null,
      raceCount,
      visibleAfterRaceNumber: bounds.first_race_number - 1,
      nextChain: bounds.first_race_slug,
      label: `${season} Season`,
      subtitle: `${season} - before Round 1`,
    };
  }

  if (chain === 'postseason') {
    return {
      season,
      chain,
      race: null,
      raceCount,
      visibleAfterRaceNumber: bounds.last_race_number,
      prevChain: bounds.last_race_slug,
      label: `${season} Season`,
      subtitle: `${season} - end of season`,
    };
  }

  const index = races.findIndex((race) => race.slug === chain);
  const race = races[index];
  if (!race) return null;

  return {
    season,
    chain,
    race,
    raceCount,
    visibleAfterRaceNumber: race.race_number - 1,
    prevChain: index > 0 ? races[index - 1].slug : 'preseason',
    nextChain: index < races.length - 1 ? races[index + 1].slug : 'postseason',
    label: `${season} ${race.name}`,
    subtitle: `${season} ${race.name}`,
  };
}

export function resolveSnapshotRef(refs: StaticSnapshotRef[], visibleAfterRaceNumber: number): StaticSnapshotRef | null {
  let match: StaticSnapshotRef | null = null;
  for (const ref of refs) {
    if (ref.after > visibleAfterRaceNumber) break;
    match = ref;
  }
  return match;
}

export function findDriver(index: StaticDriverIndex, slug: string): StaticDriverMeta | null {
  return index.drivers.find((driver) => driver.slug === slug) ?? null;
}

export function findTeam(index: StaticTeamIndex, slug: string): StaticTeamMeta | null {
  return index.teams.find((team) => team.slug === slug) ?? null;
}

export async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return response.json() as Promise<T>;
}

export function zeroDriverSnapshot(
  meta: StaticDriverMeta,
  visibleAfterRaceNumber: number,
): StaticDriverSnapshot {
  const { snapshots: _snapshots, ...driver } = meta;
  return {
    kind: 'driver',
    driver,
    visible_after_race_number: visibleAfterRaceNumber,
    career_going_in: {
      starts: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      fastest_laps: 0,
      points: 0,
      championships: 0,
    },
    prior_seasons: 0,
    season_overview: [],
    teams_driven: [],
  };
}

export function zeroTeamSnapshot(meta: StaticTeamMeta, visibleAfterRaceNumber: number): StaticTeamSnapshot {
  const { snapshots: _snapshots, ...team } = meta;
  return {
    kind: 'team',
    team,
    visible_after_race_number: visibleAfterRaceNumber,
    career_going_in: {
      entries: 0,
      wins: 0,
      podiums: 0,
      poles: 0,
      fastest_laps: 0,
      points: 0,
      championships: 0,
      drivers_fielded: 0,
    },
    driver_heroes: [],
    season_overview: [],
    drivers_fielded: [],
  };
}

export async function loadDriverSnapshot(
  meta: StaticDriverMeta,
  pit: StaticPit,
): Promise<StaticDriverSnapshot> {
  const ref = resolveSnapshotRef(meta.snapshots, pit.visibleAfterRaceNumber);
  return ref ? loadJson<StaticDriverSnapshot>(ref.path) : zeroDriverSnapshot(meta, pit.visibleAfterRaceNumber);
}

export async function loadTeamSnapshot(meta: StaticTeamMeta, pit: StaticPit): Promise<StaticTeamSnapshot> {
  const ref = resolveSnapshotRef(meta.snapshots, pit.visibleAfterRaceNumber);
  return ref ? loadJson<StaticTeamSnapshot>(ref.path) : zeroTeamSnapshot(meta, pit.visibleAfterRaceNumber);
}

export function pitForRowSeason(
  timeline: StaticTimeline,
  currentPit: StaticPit,
  season: number,
): StaticPit {
  if (season === currentPit.season) return currentPit;
  const bounds = timeline.season_bounds[String(season)];
  return {
    season,
    chain: 'postseason',
    race: null,
    raceCount: bounds?.races.length ?? 0,
    visibleAfterRaceNumber: bounds?.last_race_number ?? 0,
    prevChain: bounds?.last_race_slug,
    label: `${season} Season`,
    subtitle: `${season} - end of season`,
  };
}
