import type { CacheOptions } from 'astro';

const ACTIVE_RACE_CACHE_SECONDS = 900;
const CURRENT_SEASON_CACHE_SECONDS = 86400;
const HISTORIC_CACHE_SECONDS = 2592000;

export const NOINDEX_FOLLOW = 'noindex, follow';

type RouteCache = {
  set(options: CacheOptions | false): void;
};

export function setNoindexFollow(headers: Headers): void {
  headers.set('X-Robots-Tag', NOINDEX_FOLLOW);
}

export function getPageEdgeCacheTtl(
  season: number,
  currentSeason: number,
  isActiveRace: boolean,
): number {
  if (season < currentSeason) return HISTORIC_CACHE_SECONDS;
  return isActiveRace ? ACTIVE_RACE_CACHE_SECONDS : CURRENT_SEASON_CACHE_SECONDS;
}

export function setPageCache(
  headers: Headers,
  cache: RouteCache,
  season: number,
  isActiveRace = false,
  currentSeason = new Date().getUTCFullYear(),
): void {
  const edgeTtl = getPageEdgeCacheTtl(season, currentSeason, isActiveRace);
  cache.set({ maxAge: edgeTtl });
  headers.set('Cloudflare-CDN-Cache-Control', `max-age=${edgeTtl}`);
  headers.set('Cache-Control', `public, max-age=0, s-maxage=${edgeTtl}`);
}
