export interface SubNavItem {
  id: string;
  label: string;
  href: string;
}

export function raceSubNavItems(
  season: number,
  raceSlug: string,
  hasQuali: boolean,
  hasSprint: boolean,
): SubNavItem[] {
  const base = `/seasons/${season}/${raceSlug}`;
  return [
    { id: 'overview', label: 'Overview', href: `${base}/` },
    ...(hasQuali ? [{ id: 'qualifying', label: 'Qualifying', href: `${base}/qualifying/` }] : []),
    ...(hasSprint
      ? [
          { id: 'sprint-qualifying', label: 'Sprint Qualifying', href: `${base}/sprint-qualifying/` },
          { id: 'sprint', label: 'Sprint', href: `${base}/sprint/` },
        ]
      : []),
    { id: 'race', label: 'Race', href: `${base}/race/` },
    { id: 'standings', label: 'Standings', href: `${base}/standings/` },
    { id: 'grid', label: 'Grid', href: `${base}/drivers/` },
  ];
}
