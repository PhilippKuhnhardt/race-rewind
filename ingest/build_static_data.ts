import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { asc, eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client';
import {
  driverCareerProgression,
  drivers,
  driverStandings,
  roundEntries,
  teamCareerProgression,
  teams,
  teamStandings,
} from '../src/db/schema';
import { stripYearPrefix } from '../src/lib/format';
import {
  getAllRaces,
  getAllRacesBySeason,
  getDriverBySlug,
  getDriverCareerStats,
  getDriverPriorSeasons,
  getDriverSeasonOverview,
  getDriverTeamsDriven,
  getLatestRace,
  getTeamBySlug,
  getTeamCareerStats,
  getTeamDriverHeroes,
  getTeamDriversFielded,
  getTeamSeasonOverview,
} from '../src/lib/queries';
import type {
  StaticDriverIndex,
  StaticDriverMeta,
  StaticDriverSnapshot,
  StaticRaceEntry,
  StaticSeasonEntry,
  StaticSnapshotRef,
  StaticTeamIndex,
  StaticTeamMeta,
  StaticTeamSnapshot,
  StaticTimeline,
} from '../src/lib/static-data';

const OUT_DIR = path.resolve('public/_data');

function writeJson(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value)}\n`);
}

function hashJson(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

async function buildTimeline(): Promise<StaticTimeline> {
  const [{ seasons, byseason }, allRaces, latest] = await Promise.all([
    getAllRacesBySeason(),
    getAllRaces(),
    getLatestRace(),
  ]);

  const raceNumberMap = new Map(allRaces.map((race) => [`${race.season}/${race.race_slug}`, race.race_number]));
  const raceDateMap = new Map(allRaces.map((race) => [`${race.season}/${race.race_slug}`, race.date]));

  const staticBySeason: StaticTimeline['byseason'] = {};
  const seasonBounds: Record<string, StaticSeasonEntry> = {};

  for (const season of seasons) {
    const seasonRaces = byseason[season] ?? [];
    const staticRaces: StaticRaceEntry[] = seasonRaces.map((race, index) => ({
      slug: race.slug,
      name: race.name,
      race_number: raceNumberMap.get(`${season}/${race.slug}`) ?? 0,
      round: index + 1,
      date: raceDateMap.get(`${season}/${race.slug}`) ?? '',
    }));
    staticBySeason[String(season)] = staticRaces;

    const first = staticRaces[0];
    const last = staticRaces.at(-1);
    if (first && last) {
      seasonBounds[String(season)] = {
        season,
        first_race_number: first.race_number,
        first_race_slug: first.slug,
        last_race_number: last.race_number,
        last_race_slug: last.slug,
        races: staticRaces,
      };
    }
  }

  return {
    seasons,
    byseason: staticBySeason,
    season_bounds: seasonBounds,
    latest: {
      season: latest.season,
      race_slug: stripYearPrefix(latest.slug, latest.season),
    },
  };
}

async function getDriverCheckpointMap(): Promise<Map<number, Set<number>>> {
  const rows = await db
    .select({
      driver_id: sql<number>`driver_id`,
      race_number: sql<number>`race_number`,
    })
    .from(sql`(
      SELECT driver_id, race_number FROM ${driverCareerProgression}
      UNION
      SELECT driver_id, race_number FROM ${driverStandings}
    )`);

  const map = new Map<number, Set<number>>();
  for (const row of rows) {
    if (!map.has(row.driver_id)) map.set(row.driver_id, new Set());
    map.get(row.driver_id)!.add(row.race_number);
  }
  return map;
}

async function getTeamCheckpointMap(): Promise<Map<number, Set<number>>> {
  const rows = await db
    .select({
      team_id: sql<number>`team_id`,
      race_number: sql<number>`race_number`,
    })
    .from(sql`(
      SELECT team_id, race_number FROM ${teamCareerProgression}
      UNION
      SELECT team_id, race_number FROM ${teamStandings}
    )`);

  const map = new Map<number, Set<number>>();
  for (const row of rows) {
    if (!map.has(row.team_id)) map.set(row.team_id, new Set());
    map.get(row.team_id)!.add(row.race_number);
  }
  return map;
}

async function buildDriverSnapshots(): Promise<StaticDriverIndex> {
  const driverRows = await db
    .select({
      id: drivers.id,
      slug: drivers.slug,
      full_name: drivers.fullName,
      nationality: drivers.nationality,
      abbreviation: drivers.abbreviation,
      date_of_birth: drivers.dateOfBirth,
      permanent_car_number: drivers.permanentCarNumber,
    })
    .from(drivers)
    .innerJoin(roundEntries, eq(roundEntries.driverId, drivers.id))
    .groupBy(drivers.id)
    .orderBy(asc(drivers.fullName));

  const checkpointMap = await getDriverCheckpointMap();
  const index: StaticDriverIndex = { drivers: [] };

  for (const row of driverRows) {
    const driver = await getDriverBySlug(row.slug);
    if (!driver) continue;

    const snapshots: StaticSnapshotRef[] = [];
    let previousHash = '';
    const checkpoints = [...(checkpointMap.get(row.id) ?? [])].sort((a, b) => a - b);

    for (const afterRaceNumber of checkpoints) {
      const beforeRaceNumber = afterRaceNumber + 1;
      const [career, priorSeasons, seasonOverview, teamsDriven] = await Promise.all([
        getDriverCareerStats(row.id, beforeRaceNumber),
        getDriverPriorSeasons(row.id, beforeRaceNumber),
        getDriverSeasonOverview(row.id, beforeRaceNumber),
        getDriverTeamsDriven(row.id, beforeRaceNumber),
      ]);

      const snapshot: StaticDriverSnapshot = {
        kind: 'driver',
        driver: {
          slug: driver.slug,
          full_name: driver.full_name,
          nationality: driver.nationality,
          abbreviation: driver.abbreviation,
          date_of_birth: driver.date_of_birth,
          permanent_car_number: driver.permanent_car_number,
        },
        visible_after_race_number: afterRaceNumber,
        career_going_in: career,
        prior_seasons: priorSeasons,
        season_overview: seasonOverview,
        teams_driven: teamsDriven,
      };

      const { visible_after_race_number: _visibleAfterRaceNumber, ...hashableSnapshot } = snapshot;
      const snapshotHash = hashJson(hashableSnapshot);
      if (snapshotHash === previousHash) continue;
      previousHash = snapshotHash;

      const relativePath = `drivers/${row.slug}/${afterRaceNumber}-${snapshotHash}.json`;
      writeJson(path.join(OUT_DIR, relativePath), snapshot);
      snapshots.push({ after: afterRaceNumber, path: `/_data/${relativePath}` });
    }

    const meta: StaticDriverMeta = {
      slug: row.slug,
      full_name: row.full_name,
      nationality: row.nationality,
      abbreviation: row.abbreviation,
      date_of_birth: row.date_of_birth,
      permanent_car_number: row.permanent_car_number,
      snapshots,
    };
    index.drivers.push(meta);
  }

  return index;
}

async function buildTeamSnapshots(): Promise<StaticTeamIndex> {
  const teamRows = await db
    .select({
      id: teams.id,
      slug: teams.slug,
      name: teams.name,
      nationality: teams.nationality,
      country_code: teams.countryCode,
    })
    .from(teams)
    .innerJoin(roundEntries, eq(roundEntries.teamId, teams.id))
    .groupBy(teams.id)
    .orderBy(asc(teams.name));

  const checkpointMap = await getTeamCheckpointMap();
  const index: StaticTeamIndex = { teams: [] };

  for (const row of teamRows) {
    const team = await getTeamBySlug(row.slug);
    if (!team) continue;

    const snapshots: StaticSnapshotRef[] = [];
    let previousHash = '';
    const checkpoints = [...(checkpointMap.get(row.id) ?? [])].sort((a, b) => a - b);

    for (const afterRaceNumber of checkpoints) {
      const beforeRaceNumber = afterRaceNumber + 1;
      const [career, driverHeroes, seasonOverview, driversFielded] = await Promise.all([
        getTeamCareerStats(row.id, beforeRaceNumber),
        getTeamDriverHeroes(row.id, beforeRaceNumber),
        getTeamSeasonOverview(row.id, beforeRaceNumber),
        getTeamDriversFielded(row.id, beforeRaceNumber),
      ]);

      const snapshot: StaticTeamSnapshot = {
        kind: 'team',
        team: {
          slug: team.slug,
          name: team.name,
          nationality: team.nationality,
          country_code: team.country_code,
        },
        visible_after_race_number: afterRaceNumber,
        career_going_in: career,
        driver_heroes: driverHeroes,
        season_overview: seasonOverview,
        drivers_fielded: driversFielded,
      };

      const { visible_after_race_number: _visibleAfterRaceNumber, ...hashableSnapshot } = snapshot;
      const snapshotHash = hashJson(hashableSnapshot);
      if (snapshotHash === previousHash) continue;
      previousHash = snapshotHash;

      const relativePath = `teams/${row.slug}/${afterRaceNumber}-${snapshotHash}.json`;
      writeJson(path.join(OUT_DIR, relativePath), snapshot);
      snapshots.push({ after: afterRaceNumber, path: `/_data/${relativePath}` });
    }

    const meta: StaticTeamMeta = {
      slug: row.slug,
      name: row.name,
      nationality: row.nationality,
      country_code: row.country_code,
      snapshots,
    };
    index.teams.push(meta);
  }

  return index;
}

async function main(): Promise<void> {
  const started = performance.now();
  rmSync(OUT_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  mkdirSync(OUT_DIR, { recursive: true });

  console.log('Building static timeline data ...');
  const timeline = await buildTimeline();
  writeJson(path.join(OUT_DIR, 'timeline.json'), timeline);

  console.log('Building static driver snapshots ...');
  const driverIndex = await buildDriverSnapshots();
  writeJson(path.join(OUT_DIR, 'drivers/index.json'), driverIndex);

  console.log('Building static team snapshots ...');
  const teamIndex = await buildTeamSnapshots();
  writeJson(path.join(OUT_DIR, 'teams/index.json'), teamIndex);

  const elapsed = ((performance.now() - started) / 1000).toFixed(1);
  const driverSnapshots = driverIndex.drivers.reduce((sum, driver) => sum + driver.snapshots.length, 0);
  const teamSnapshots = teamIndex.teams.reduce((sum, team) => sum + team.snapshots.length, 0);
  console.log(`Done in ${elapsed}s: ${driverSnapshots} driver snapshots, ${teamSnapshots} team snapshots.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
