import { stripYearPrefix } from './format';
import type { PageContext } from './types';

export interface LatestRaceForNav {
  season: number;
  slug: string;
}

export interface PageNavState {
  currentSeason: number;
  currentRaceSlug: string;
  currentChainSlug: string;
  compareSlug: string;
  section: 'seasons' | 'stats';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled page context: ${JSON.stringify(value)}`);
}

export function resolvePageNavState(
  pageContext: PageContext | undefined,
  latest: LatestRaceForNav,
): PageNavState {
  const latestSlug = stripYearPrefix(latest.slug, latest.season);

  if (!pageContext) {
    return {
      currentSeason: latest.season,
      currentRaceSlug: latestSlug,
      currentChainSlug: latestSlug,
      compareSlug: latestSlug,
      section: 'seasons',
    };
  }

  const currentSeason = pageContext.season;

  switch (pageContext.kind) {
    case 'race':
    case 'driver-race':
    case 'team-race':
    case 'compare-race':
      return {
        currentSeason,
        currentRaceSlug: pageContext.raceSlug,
        currentChainSlug: pageContext.raceSlug,
        compareSlug: pageContext.raceSlug,
        section: 'seasons',
      };

    case 'preseason':
      return {
        currentSeason,
        currentRaceSlug: pageContext.firstRaceSlug,
        currentChainSlug: 'preseason',
        compareSlug: 'preseason',
        section: 'seasons',
      };

    case 'driver-preseason':
    case 'team-preseason':
      return {
        currentSeason,
        currentRaceSlug: pageContext.nextRaceSlug,
        currentChainSlug: 'preseason',
        compareSlug: 'preseason',
        section: 'seasons',
      };

    case 'postseason':
      return {
        currentSeason,
        currentRaceSlug: pageContext.prevRaceSlug,
        currentChainSlug: 'postseason',
        compareSlug: 'postseason',
        section: 'seasons',
      };

    case 'driver-postseason':
    case 'team-postseason':
      return {
        currentSeason,
        currentRaceSlug: pageContext.prevRaceSlug,
        currentChainSlug: 'postseason',
        compareSlug: 'postseason',
        section: 'seasons',
      };

    case 'stats':
      return {
        currentSeason,
        currentRaceSlug: pageContext.chainSlug,
        currentChainSlug: pageContext.chainSlug,
        compareSlug: pageContext.chainSlug,
        section: 'stats',
      };

    case 'season':
      return {
        currentSeason,
        currentRaceSlug: pageContext.chainSlug,
        currentChainSlug: pageContext.chainSlug,
        compareSlug: pageContext.chainSlug,
        section: 'seasons',
      };

    default:
      return assertNever(pageContext);
  }
}
