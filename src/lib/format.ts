/** Replace a null/undefined string with an em-dash for display. */
export function orDash(t: string | null | undefined): string {
  return t ?? '—';
}

/** Format a points value — strip trailing ".0" for whole numbers. */
export function formatPts(pts: number | null | undefined): string {
  if (pts == null) return '—';
  return pts % 1 === 0 ? String(pts) : pts.toFixed(1);
}

/**
 * Format a finishing position.
 * Returns 'DNF' for null — null means did not finish, not missing data.
 */
export function formatPos(pos: number | null | undefined): string {
  if (pos == null) return 'DNF';
  return String(pos);
}

/** Parse "H:MM:SS.mmm" or "M:SS.mmm" race time into milliseconds. */
function parseRaceTime(t: string): number {
  const parts = t.split(':');
  if (parts.length === 3) {
    return (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 1000;
  }
  return (parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 1000;
}

/** Compute the gap string for a finisher relative to the winner: "+9.433s", "+1:02.456s". */
export function computeGap(winnerTime: string, rowTime: string): string {
  const ms = parseRaceTime(rowTime) - parseRaceTime(winnerTime);
  const s = ms / 1000;
  if (s < 60) return `+${s.toFixed(3)}s`;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(3).padStart(6, '0');
  return `+${m}:${rem}`;
}

/** True when a detail string represents laps-down status ("+1 Lap", "+3 Laps", etc.). */
export function isLapDetail(detail: string | null | undefined): boolean {
  return detail != null && /^\+\d+ Lap/i.test(detail);
}

/** Format a standings position delta for display, e.g. +2, -1, = */
export function formatDelta(before: number | null, after: number | null): string {
  if (before == null || after == null) return '—';
  const d = before - after; // positive = moved up
  if (d === 0) return '=';
  return d > 0 ? `+${d}` : String(d);
}

/** Strip the leading "{year}-" prefix baked into race slugs by the ingestion pipeline. */
export function stripYearPrefix(slug: string, season: number): string {
  return slug.slice(String(season).length + 1);
}

/** Compute the "Time / Gap" cell value for a race result row. */
export function formatGap(
  winnerTime: string | null,
  row: { position: number | null; time: string | null; detail: string | null }
): string {
  if (row.position === 1) return row.time ?? '—';
  if (row.time != null && winnerTime != null) return computeGap(winnerTime, row.time);
  if (isLapDetail(row.detail)) return row.detail!;
  return '—';
}
