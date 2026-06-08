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

  type DriverState = Extract<StaticLoadedState, { route: { kind: 'driver' } }>;

  interface Props {
    state: DriverState;
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
  <h1 class="text-2xl font-bold text-fg">{snapshot.driver.full_name}</h1>
  <p class="mt-1 text-sm text-fg-muted">
    {[
      snapshot.driver.nationality ? emojify(snapshot.driver.nationality) : null,
      snapshot.driver.date_of_birth ? `b. ${snapshot.driver.date_of_birth}` : null,
      snapshot.driver.abbreviation,
      snapshot.driver.permanent_car_number ? `#${snapshot.driver.permanent_car_number}` : null,
    ]
      .filter(Boolean)
      .join(' · ')}
  </p>
</div>

{@render StatGrid(
  [
    { label: 'Starts', value: stats.starts },
    { label: 'Wins', value: stats.wins },
    { label: 'Podiums', value: stats.podiums },
    { label: 'Poles', value: stats.poles },
    { label: 'Fastest Laps', value: stats.fastest_laps },
    { label: 'Career Points', value: formatPts(stats.points) },
    { label: 'Championships', value: stats.championships, accent: stats.championships > 0 },
    { label: 'Seasons', value: snapshot.prior_seasons },
  ],
  state.pit.chain === 'postseason'
    ? 'Career After the Season'
    : state.pit.chain === 'preseason'
      ? 'Career Going Into the Season'
      : 'Career Going Into This Race',
)}

{#if snapshot.season_overview.length > 0}
  <section class="mb-6">
    <h2 class="mb-4 text-lg font-semibold text-fg">Season Overview</h2>
    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Season</th>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Team</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Starts</th>
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
                <a class="text-accent hover:underline" href={driverHref(snapshot.driver.slug, rowPit)}>{row.season}</a>
              </td>
              <td class="px-3 py-2.5">
                <span class="inline-flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full border border-border" style={swatchStyle(row.team_slug, row.season)}></span>
                  <a class="font-medium text-accent hover:underline" href={teamHref(row.team_slug, rowPit)}>{row.team_name}</a>
                </span>
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums">{row.starts}</td>
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

{#if snapshot.teams_driven.length > 0}
  <section class="mb-6">
    <h2 class="mb-4 text-lg font-semibold text-fg">Teams Driven For</h2>
    <div class="overflow-x-auto rounded-lg border border-border">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Team</th>
            <th class="bg-bg-alt px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-fg-muted">Years</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Starts</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Wins</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">Points</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">WDC</th>
            <th class="bg-bg-alt px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-fg-muted">WCC</th>
          </tr>
        </thead>
        <tbody>
          {#each snapshot.teams_driven as row}
            <tr class="border-b border-border last:border-0 hover:bg-bg-hover">
              <td class="px-3 py-2.5">
                <span class="inline-flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full border border-border" style={swatchStyle(row.team_slug, row.color_season)}></span>
                  <a class="font-medium text-accent hover:underline" href={teamHref(row.team_slug, state.pit)}>{row.name}</a>
                </span>
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
