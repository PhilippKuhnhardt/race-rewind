<script lang="ts">
  import DriverCombobox from './DriverCombobox.svelte';
  import RaceCombobox from './RaceCombobox.svelte';
  import type { DriverPickerEntry, RacePickerEntry, DriverAtRacePayload } from '../../lib/api-types';
  import { formatPts } from '../../lib/format';

  let drivers = $state<DriverPickerEntry[]>([]);
  let races = $state<RacePickerEntry[]>([]);

  let driverASlug = $state('');
  let driverBSlug = $state('');
  let raceKey = $state('');

  let payloadA = $state<DriverAtRacePayload | null>(null);
  let payloadB = $state<DriverAtRacePayload | null>(null);
  let loading = $state(false);
  let error = $state('');

  function parseUrlParams() {
    const p = new URLSearchParams(window.location.search);
    driverASlug = p.get('a') ?? '';
    driverBSlug = p.get('b') ?? '';
    raceKey = p.get('race') ?? '';
  }

  function updateUrl() {
    const p = new URLSearchParams();
    if (driverASlug) p.set('a', driverASlug);
    if (driverBSlug) p.set('b', driverBSlug);
    if (raceKey) p.set('race', raceKey);
    const url = `${window.location.pathname}?${p.toString()}`;
    history.replaceState(null, '', url);
  }

  function raceSeason(key: string) {
    return key.slice(0, 4);
  }

  function raceSlug(key: string) {
    return key.slice(5);
  }

  async function fetchPayloads() {
    if (!driverASlug || !driverBSlug || !raceKey) return;
    loading = true;
    error = '';
    payloadA = null;
    payloadB = null;
    try {
      const season = raceSeason(raceKey);
      const slug = raceSlug(raceKey);
      const [resA, resB] = await Promise.all([
        fetch(`/api/drivers/${driverASlug}/${season}/${slug}.json`),
        fetch(`/api/drivers/${driverBSlug}/${season}/${slug}.json`),
      ]);
      if (!resA.ok || !resB.ok) {
        error = 'One or both drivers did not compete in this race.';
        return;
      }
      [payloadA, payloadB] = await Promise.all([resA.json(), resB.json()]);
    } catch {
      error = 'Failed to load comparison data.';
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    parseUrlParams();
    Promise.all([
      fetch('/api/drivers/index.json').then((r) => r.json()),
      fetch('/api/races/index.json').then((r) => r.json()),
    ]).then(([d, r]) => {
      drivers = d;
      races = r;
      if (driverASlug && driverBSlug && raceKey) fetchPayloads();
    });
  });

  function onSelectA(slug: string) {
    driverASlug = slug;
    updateUrl();
    fetchPayloads();
  }

  function onSelectB(slug: string) {
    driverBSlug = slug;
    updateUrl();
    fetchPayloads();
  }

  function onSelectRace(season: number, slug: string) {
    raceKey = `${season}-${slug}`;
    updateUrl();
    fetchPayloads();
  }

  const statRows: { label: string; key: keyof DriverAtRacePayload['career_going_in'] }[] = [
    { label: 'Starts', key: 'starts' },
    { label: 'Wins', key: 'wins' },
    { label: 'Podiums', key: 'podiums' },
    { label: 'Poles', key: 'poles' },
    { label: 'Fastest Laps', key: 'fastest_laps' },
    { label: 'Career Points', key: 'points' },
    { label: 'Championships', key: 'championships' },
  ];

  function fmt(key: keyof DriverAtRacePayload['career_going_in'], val: number): string {
    return key === 'points' ? formatPts(val) : String(val);
  }
</script>

<div class="space-y-6">
  <div class="rounded-lg border border-border bg-bg-alt p-4">
    <h2 class="mb-4 text-base font-semibold text-fg">Select Drivers &amp; Race</h2>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <DriverCombobox label="Driver A" {drivers} value={driverASlug} onselect={onSelectA} />
      <DriverCombobox label="Driver B" {drivers} value={driverBSlug} onselect={onSelectB} />
      <RaceCombobox {races} value={raceKey} onselect={onSelectRace} />
    </div>
  </div>

  {#if loading}
    <div class="text-sm text-fg-muted">Loading…</div>
  {:else if error}
    <div class="rounded-lg border border-border bg-bg-alt p-4 text-sm text-fg-muted">{error}</div>
  {:else if payloadA && payloadB}
    <div class="space-y-4">
      <div class="rounded-lg border border-border overflow-hidden">
        <div class="grid grid-cols-3 border-b border-border">
          <div class="bg-bg-alt p-3 font-semibold text-fg text-center text-sm truncate">{payloadA.driver.full_name}</div>
          <div class="bg-bg-alt p-3 text-center text-xs font-semibold uppercase tracking-wide text-fg-muted border-x border-border">
            {payloadA.race.season} {payloadA.race.name}
          </div>
          <div class="bg-bg-alt p-3 font-semibold text-fg text-center text-sm truncate">{payloadB.driver.full_name}</div>
        </div>

        <div class="divide-y divide-border">
          {#each statRows as row}
            {@const valA = payloadA.career_going_in[row.key]}
            {@const valB = payloadB.career_going_in[row.key]}
            {@const aWins = Number(valA) > Number(valB)}
            {@const bWins = Number(valB) > Number(valA)}
            <div class="grid grid-cols-3 text-sm">
              <div class={`px-3 py-2.5 text-right tabular-nums ${aWins ? 'font-bold text-accent' : 'text-fg'}`}>
                {fmt(row.key, valA as number)}
              </div>
              <div class="px-3 py-2.5 text-center text-xs text-fg-muted border-x border-border">{row.label}</div>
              <div class={`px-3 py-2.5 tabular-nums ${bWins ? 'font-bold text-accent' : 'text-fg'}`}>
                {fmt(row.key, valB as number)}
              </div>
            </div>
          {/each}
        </div>
      </div>

      <div class="rounded-lg border border-border overflow-hidden">
        <div class="bg-bg-alt px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Championship Standing — Going Into This Race
        </div>
        <div class="grid grid-cols-3 text-sm divide-x divide-border">
          <div class="p-3 space-y-1">
            {#if payloadA.standing_going_in}
              <div class="tabular-nums font-bold text-accent">P{payloadA.standing_going_in.position ?? '—'}</div>
              <div class="text-xs text-fg-muted">{formatPts(payloadA.standing_going_in.points)} pts · {payloadA.standing_going_in.win_count} wins</div>
            {:else}
              <div class="text-fg-muted">First race</div>
            {/if}
          </div>
          <div class="p-3 text-center text-xs text-fg-muted flex items-center justify-center">Standing</div>
          <div class="p-3 space-y-1">
            {#if payloadB.standing_going_in}
              <div class="tabular-nums font-bold text-accent">P{payloadB.standing_going_in.position ?? '—'}</div>
              <div class="text-xs text-fg-muted">{formatPts(payloadB.standing_going_in.points)} pts · {payloadB.standing_going_in.win_count} wins</div>
            {:else}
              <div class="text-fg-muted">First race</div>
            {/if}
          </div>
        </div>
      </div>

      {#if payloadA.result_this_race || payloadB.result_this_race}
        <div class="rounded-lg border border-border overflow-hidden">
          <div class="bg-bg-alt px-3 py-2 border-b border-border text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Race Result
          </div>
          <div class="grid grid-cols-3 text-sm divide-x divide-border">
            <div class="p-3">
              {#if payloadA.result_this_race}
                <div class="font-bold text-fg">P{payloadA.result_this_race.position ?? 'DNF'}</div>
                {#if payloadA.result_this_race.detail}
                  <div class="text-xs text-fg-muted">{payloadA.result_this_race.detail}</div>
                {/if}
                {#if payloadA.result_this_race.points}
                  <div class="text-xs text-fg-muted">{payloadA.result_this_race.points} pts</div>
                {/if}
              {:else}
                <div class="text-fg-muted">DNS / No entry</div>
              {/if}
            </div>
            <div class="p-3 text-center text-xs text-fg-muted flex items-center justify-center">Result</div>
            <div class="p-3">
              {#if payloadB.result_this_race}
                <div class="font-bold text-fg">P{payloadB.result_this_race.position ?? 'DNF'}</div>
                {#if payloadB.result_this_race.detail}
                  <div class="text-xs text-fg-muted">{payloadB.result_this_race.detail}</div>
                {/if}
                {#if payloadB.result_this_race.points}
                  <div class="text-xs text-fg-muted">{payloadB.result_this_race.points} pts</div>
                {/if}
              {:else}
                <div class="text-fg-muted">DNS / No entry</div>
              {/if}
            </div>
          </div>
        </div>
      {/if}

      <div class="rounded-lg border border-dashed border-border bg-bg-alt p-4 text-sm text-fg-muted text-center">
        Coming soon: head-to-head record (races shared, qualifying H2H, wins when both finished)
      </div>
    </div>
  {:else if driverASlug || driverBSlug || raceKey}
    <div class="text-sm text-fg-muted">Select both drivers and a race to compare.</div>
  {/if}
</div>
