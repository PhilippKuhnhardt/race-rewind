import type { PointInTime } from './point-in-time';

function pitSlug(pit: PointInTime): string {
  if (pit.kind === 'preseason') return 'preseason';
  if (pit.kind === 'postseason') return 'postseason';
  return pit.raceSlug;
}

export function driverLinkAt(slug: string, pit: PointInTime): string {
  return `/drivers/${slug}/${pit.season}/${pitSlug(pit)}/`;
}

export function teamLinkAt(slug: string, pit: PointInTime): string {
  return `/teams/${slug}/${pit.season}/${pitSlug(pit)}/`;
}

export function raceLinkAt(pit: PointInTime): string {
  return `/seasons/${pit.season}/${pitSlug(pit)}/`;
}

export function raceSubpageLinkAt(
  pit: PointInTime,
  sub: 'grid' | 'race' | 'qualifying' | 'sprint' | 'sprint-qualifying' | 'standings' | 'drivers' | 'teams',
): string {
  return `${raceLinkAt(pit)}${sub}/`;
}

export function compareLinkAt(pit: PointInTime, opts?: { prefillDriverSlug?: string }): string {
  const base = `/compare/${pit.season}/${pitSlug(pit)}/`;
  return opts?.prefillDriverSlug ? `${base}?prefill=${opts.prefillDriverSlug}` : base;
}

export function compareTwoDriversLinkAt(driverA: string, driverB: string, pit: PointInTime): string {
  return `/compare/${driverA}/${driverB}/${pit.season}/${pitSlug(pit)}/`;
}

export function statsLinkAt(pit: PointInTime): string {
  return `/stats/${pit.season}/${pitSlug(pit)}/`;
}

export function seasonLinkAt(pit: PointInTime): string {
  return `${raceLinkAt(pit)}season/`;
}

// ---------------------------------------------------------------------------
// Shims for callers that still pass raw (season, raceSlug) pairs —
// these delegate to the PIT-based helpers and will be removed once all
// callers are migrated.
// ---------------------------------------------------------------------------

export const driverLink = (slug: string, season: number | string, raceSlug: string): string =>
  `/drivers/${slug}/${season}/${raceSlug}/`;

export const teamLink = (slug: string, season: number | string, raceSlug: string): string =>
  `/teams/${slug}/${season}/${raceSlug}/`;

export const raceLink = (season: number | string, raceSlug: string): string =>
  `/seasons/${season}/${raceSlug}/`;

export const preseasonLink = (season: number | string): string =>
  `/seasons/${season}/preseason/`;

export const postseasonLink = (season: number | string): string =>
  `/seasons/${season}/postseason/`;
