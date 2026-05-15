import { driverLink, teamLink, preseasonLink } from '../lib/format';

export interface SeasonNavContext {
  kind: 'season' | 'driver' | 'team';
  entitySlug?: string;
  entitySeasons?: Record<string, string>;
}

export function navigateToSeason(season: string, ctx?: SeasonNavContext | null): void {
  if (ctx && ctx.entitySlug) {
    const entitySeasons = ctx.entitySeasons ?? {};
    const raceSlug = entitySeasons[season];
    if (raceSlug !== undefined) {
      if (ctx.kind === 'driver') {
        window.location.href = driverLink(ctx.entitySlug, season, raceSlug);
        return;
      }
      if (ctx.kind === 'team') {
        window.location.href = teamLink(ctx.entitySlug, season, raceSlug);
        return;
      }
    }
  }
  window.location.href = preseasonLink(season);
}

export function bindSeasonSelect(
  selectEl: HTMLSelectElement,
  ctx?: SeasonNavContext | null,
): void {
  selectEl.addEventListener('change', () => navigateToSeason(selectEl.value, ctx));
}
