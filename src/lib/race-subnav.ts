export interface SubNavItem {
  id: string;
  label: string;
  href: string;
}

export function raceSubNavItems(
  season: number,
  raceSlug: string,
  sessionOrder: string[],
  hasQuali: boolean,
  hasSprintQualifying: boolean,
  hasSprint: boolean,
  hasGrid: boolean = false,
): SubNavItem[] {
  const base = `/seasons/${season}/${raceSlug}`;
  const items: SubNavItem[] = [{ id: 'overview', label: 'Overview', href: `${base}/` }];

  for (const id of sessionOrder) {
    if (id === 'qualifying' && hasQuali) {
      items.push({ id, label: 'Qualifying', href: `${base}/qualifying/` });
    } else if (id === 'sprint-qualifying' && hasSprintQualifying) {
      items.push({ id, label: 'Sprint Qualifying', href: `${base}/sprint-qualifying/` });
    } else if (id === 'sprint' && hasSprint) {
      items.push({ id, label: 'Sprint', href: `${base}/sprint/` });
    } else if (id === 'race') {
      if (hasGrid) items.push({ id: 'grid', label: 'Starting Grid', href: `${base}/grid/` });
      items.push({ id, label: 'Race', href: `${base}/race/` });
    }
  }

  items.push({ id: 'standings', label: 'Standings', href: `${base}/standings/` });
  return items;
}
