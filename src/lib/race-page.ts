import { getAllRacesBySeason, getRaceBySlug, getSeasonBookends, getRaceNumbersWithQualifying } from './queries';
import type { PageContext } from './types';

export async function getRacePageBase(season: string, raceSlug: string) {
  const fullSlug = `${season}-${raceSlug}`;

  const [race, { byseason }, qualiSet] = await Promise.all([
    getRaceBySlug(fullSlug),
    getAllRacesBySeason(),
    getRaceNumbersWithQualifying(),
  ]);

  if (!race) return undefined;

  const { raceCount } = await getSeasonBookends(race.season);

  const seasonRaces = byseason[race.season] ?? [];
  const idx = seasonRaces.findIndex((r) => r.slug === raceSlug);
  const prevRaceSlug = idx > 0 ? seasonRaces[idx - 1].slug : 'preseason';
  const nextRaceSlug = idx < seasonRaces.length - 1 ? seasonRaces[idx + 1].slug : 'postseason';

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

  const hasQuali = qualiSet.has(race.race_number);

  return { race, raceCount, prevRaceSlug, nextRaceSlug, pageContext, hasQuali };
}
