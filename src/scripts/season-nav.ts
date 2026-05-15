export interface SeasonNavContext {
  kind: 'season' | 'driver';
  entitySlug?: string;
  entitySeasons?: Record<string, string>;
}

export function navigateToSeason(season: string, ctx?: SeasonNavContext | null): void {
  if (ctx && ctx.kind === 'driver' && ctx.entitySlug) {
    const entitySeasons = ctx.entitySeasons ?? {};
    if (entitySeasons[season] !== undefined) {
      window.location.href = `/drivers/${ctx.entitySlug}/${season}/${entitySeasons[season]}/`;
      return;
    }
  }
  window.location.href = `/seasons/${season}/preseason/`;
}

export function bindSeasonSelect(
  selectEl: HTMLSelectElement,
  ctx?: SeasonNavContext | null,
): void {
  selectEl.addEventListener('change', () => navigateToSeason(selectEl.value, ctx));
}
