<script lang="ts">
  import { formatPts, ordinal } from '../../lib/format';
  import {
    driverHref,
    pitForRowSeason,
    raceHref,
    teamHref,
    type StaticLoadedState,
  } from '../../lib/static-client';
  import { teamColor } from '../../lib/team-colors';
  import { emojify } from '../../lib/ui/emojify';

  type TeamState = Extract<StaticLoadedState, { route: { kind: 'team' } }>;

  interface Props {
    state: TeamState;
  }

  let { state }: Props = $props();
  const snapshot = $derived(state.snapshot);
  const stats = $derived(snapshot.career_going_in);

  function swatchStyle(slug: string | null | undefined, season: number): string {
    const color = teamColor(slug, season);
    return color ? `background-color: ${color}` : '';
  }
</script>

{#snippet StatGrid(rows: { label: string; value: string | number; accent?: boolean }[], title: string)}
  <section class="mb-4">
    <h2 class="mb-4 text-lg font-semibold text-fg">{title}</h2>
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {#each rows as row}
        <div class="rounded-lg border border-border bg-bg-alt p-3">
          <div class="text-xs uppercase tracking-wide text-fg-muted">{row.label}</div>
          <div class="mt-1 text-xl font-bold {row.accent ? 'text-accent' : 'text-fg'}">
            {row.value}
          </div>
        </div>
      {/each}
    </div>
  </section>
{/snippet}

<div class="mb-4">
  <a href={raceHref(state.pit)} class="text-sm text-fg-muted transition-colors hover:text-accent">
    ← {state.pit.subtitle}
  </a>
</div>

<div class="mb-6">
  <div class="mb-2 h-1 w-12 rounded-full" style={swatchStyle(snapshot.team.slug, state.pit.season)}></div>
  <h1 class="text-2xl font-bold text-fg">{snapshot.team.name}</h1>
  {#if snapshot.team.nationality}
    <p class="mt-1 text-sm text-fg-muted">{emojify(snapshot.team.nationality)}</p>
  {/if}
</div>

{@render StatGrid(
  [
    { label: 'Race Entries', value: stats.entries },
    { label: 'Wins', value: stats.wins },
    { label: 'Podiums', value: stats.podiums },
    { label: 'Poles', value: stats.poles },
    { label: 'Fastest Laps', value: stats.fastest_laps },
    { label: 'Career Points', value: formatPts(stats.points) },
    { label: "Constructors' Titles", value: stats.championships, accent: stats.championships > 0 },
    { label: 'Drivers Fielded', value: stats.drivers_fielded },
  ],
  state.pit.chain === 'postseason'
    ? 'Stats After the Season'
    : state.pit.chain === 'preseason'
      ? 'Stats Going Into the Season'
      : 'Stats Going Into This Race',
)}

{#if snapshot.driver_heroes.length > 0}
  <section class="mb-6">
    <h2 class="mb-4 text-lg font-semibold text-fg">Successful Drivers</h2>
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {#each snapshot.driver_heroes as driver}
        <article class="rounded-lg border border-border bg-bg-alt p-4">
          <div class="mb-3 flex min-h-16 flex-col justify-between gap-2">
            <div class="text-xs font-semibold uppercase tracking-wide text-accent">
              {driver.reason.replace(/_/g, ' ')}
            </div>
            <div>
              <a href={driverHref(driver.driver_slug, state.pit)} class="text-lg font-bold leading-tight text-fg hover:text-accent">
                {driver.full_name}
              </a>
              <div class="mt-1 text-sm text-fg-muted">
                {driver.years}{driver.nationality ? ` · ${emojify(driver.nationality)}` : ''}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2 border-t border-border pt-3">
            <div>
              <div class="text-xs uppercase tracking-wide text-fg-muted">Starts</div>
              <div class="mt-1 text-lg font-bold tabular-nums">{driver.starts}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-fg-muted">Wins</div>
              <div class="mt-1 text-lg font-bold tabular-nums">{driver.wins}</div>
            </div>
            <div>
              <div class="text-xs uppercase tracking-wide text-fg-muted">Titles</div>
              <div class="mt-1 text-lg font-bold tabular-nums">{driver.driver_championships}</div>
            </div>
          </div>
        </article>
      {/each}
    </div>
  </section>
{/if}

{#if snapshot.season_overview.length > 0}
  <section class="mb-6">
    <h2 class="mb-4 text-lg font-semibold text-fg">Season Overview</h2>
    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Season</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">GPs</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Wins</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Podiums</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Poles</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Points</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Championship</th>
          </tr>
        </thead>
        <tbody>
          {#each snapshot.season_overview as row}
            {@const rowPit = pitForRowSeason(state.timeline, state.pit, row.season)}
            <tr class="border-b border-border last:border-0 hover:bg-bg-hover">
              <td class="px-3 py-2.5 font-medium tabular-nums">
                <a class="text-accent hover:underline" href={teamHref(snapshot.team.slug, rowPit)}>{row.season}</a>
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.grand_prix}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.wins}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.podiums}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.poles}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{formatPts(row.points)}</td>
              <td class="px-3 py-2.5 text-right tabular-nums text-fg-muted">
                {row.championship_position != null ? ordinal(row.championship_position) : '—'}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}

{#if snapshot.drivers_fielded.length > 0}
  <section class="mb-6">
    <h2 class="mb-4 text-lg font-semibold text-fg">Drivers Fielded</h2>
    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Driver</th>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Years</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Starts</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Wins</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Points</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">WDC</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">WCC</th>
          </tr>
        </thead>
        <tbody>
          {#each snapshot.drivers_fielded as row}
            <tr class="border-b border-border last:border-0 hover:bg-bg-hover">
              <td class="px-3 py-2.5">
                <a class="font-medium text-accent hover:underline" href={driverHref(row.driver_slug, state.pit)}>{row.full_name}</a>
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-fg-muted">{row.years}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.starts}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.wins}</td>
              <td class="px-3 py-2.5 text-right tabular-nums">{formatPts(row.points)}</td>
              <td class="px-3 py-2.5 text-right tabular-nums text-fg-muted">{row.driver_championships || '—'}</td>
              <td class="px-3 py-2.5 text-right tabular-nums text-fg-muted">{row.team_championships || '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}
