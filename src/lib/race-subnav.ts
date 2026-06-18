export interface SubNavItem {
  id: string;
  label: string;
  href: string;
}

export function raceSubNavItems(
  season: number,
  raceSlug: string,
  sessionOrder: string[],
  hasGrid: boolean = false,
  overviewOnly: boolean = false,
  hasStandings: boolean = true,
): SubNavItem[] {
  const base = `/seasons/${season}/${raceSlug}`;
  const items: SubNavItem[] = [{ id: 'overview', label: 'Overview', href: `${base}/` }];

  if (overviewOnly) return items;

  for (const id of sessionOrder) {
    if (id === 'qualifying') {
      items.push({ id, label: 'Qualifying', href: `${base}/qualifying/` });
    } else if (id === 'sprint-qualifying') {
      items.push({ id, label: 'Sprint Qualifying', href: `${base}/sprint-qualifying/` });
    } else if (id === 'sprint') {
      items.push({ id, label: 'Sprint', href: `${base}/sprint/` });
    } else if (id === 'race') {
      if (hasGrid) items.push({ id: 'grid', label: 'Starting Grid', href: `${base}/grid/` });
      items.push({ id, label: 'Race', href: `${base}/race/` });
    }
  }

  if (hasStandings) items.push({ id: 'standings', label: 'Standings', href: `${base}/standings/` });
  return items;
}
