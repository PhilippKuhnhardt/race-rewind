import { getAllRacesBySeason, getRaceBySlug, getSeasonBookends } from './queries';
import type { PageContext } from './types';

export async function getRacePageBase(season: string, raceSlug: string) {
  const fullSlug = `${season}-${raceSlug}`;

  const [race, { byseason }] = await Promise.all([
    getRaceBySlug(fullSlug),
    getAllRacesBySeason(),
  ]);

  if (!race) return undefined;

  const { raceCount } = await getSeasonBookends(race.season);

  const seasonRaces = byseason[race.season] ?? [];
  const idx = seasonRaces.findIndex((r) => r.slug === raceSlug);
  const prevRaceSlug = idx > 0 ? seasonRaces[idx - 1].slug : undefined;
  const nextRaceSlug = idx < seasonRaces.length - 1 ? seasonRaces[idx + 1].slug : undefined;

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

  return { race, raceCount, prevRaceSlug, nextRaceSlug, pageContext };
}
