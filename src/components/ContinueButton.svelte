<script lang="ts">
  type RaceEntry = { kind: 'race'; season: number; raceSlug: string; name: string; flag: string | null };
  type PreEntry = { kind: 'preseason'; season: number };
  type PostEntry = { kind: 'postseason'; season: number };
  type LastRace = RaceEntry | PreEntry | PostEntry;

  interface Props {
    seasons: number[];
  }

  let { seasons }: Props = $props();

  const sortedSeasons = $derived([...seasons].sort((a, b) => b - a));

  function isLastRace(v: unknown): v is LastRace {
    if (typeof v !== 'object' || v === null) return false;
    const o = v as Record<string, unknown>;
    if (typeof o.season !== 'number') return false;
    if (o.kind === 'race') return typeof o.raceSlug === 'string' && typeof o.name === 'string';
    return o.kind === 'preseason' || o.kind === 'postseason';
  }

  function readLastRace(): LastRace | null {
    try {
      const raw = localStorage.getItem('lastRace');
      if (!raw) return null;
      const data: unknown = JSON.parse(raw);
      if (isLastRace(data)) return data;
      localStorage.removeItem('lastRace');
    } catch {
      try { localStorage.removeItem('lastRace'); } catch { /* ignore */ }
    }
    return null;
  }

  const entry = readLastRace();

  function getHref(r: LastRace): string {
    if (r.kind === 'race') return `/seasons/${r.season}/${r.raceSlug}/`;
    if (r.kind === 'preseason') return `/seasons/${r.season}/preseason/`;
    return `/seasons/${r.season}/postseason/`;
  }

  function getLabel(r: LastRace): string {
    if (r.kind === 'race') return `${r.flag ? r.flag + ' ' : ''}${r.season} ${r.name}`;
    if (r.kind === 'preseason') return `${r.season} Pre-Season`;
    return `${r.season} Season`;
  }

  function startSeason(event: Event) {
    const season = (event.target as HTMLSelectElement).value;
    if (season) window.location.href = `/seasons/${season}/preseason/`;
  }
</script>

{#if entry}
  <a
    href={getHref(entry)}
    class="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity no-underline hover:opacity-90"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    {getLabel(entry)}
  </a>
{:else}
  <div class="flex flex-col items-center justify-center gap-2 sm:flex-row">
    <select
      id="home-season"
      aria-label="Season"
      class="w-full max-w-56 rounded-lg border border-border bg-bg px-4 py-2.5 text-base font-medium text-fg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-48"
      onchange={startSeason}
    >
      <option value="" disabled selected>Pick a season</option>
      {#each sortedSeasons as season}
        <option value={season}>{season}</option>
      {/each}
    </select>
  </div>
{/if}
