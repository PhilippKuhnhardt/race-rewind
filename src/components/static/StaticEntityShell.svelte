<script lang="ts">
  import { onMount } from 'svelte';
  import MobileNav from '../layout/MobileNav.svelte';
  import RacePicker from '../layout/RacePicker.svelte';
  import YearPicker from '../layout/YearPicker.svelte';
  import ThemeToggle from '../primitives/ThemeToggle.svelte';
  import StaticComparePage from './StaticComparePage.svelte';
  import StaticDriverPage from './StaticDriverPage.svelte';
  import StaticTeamPage from './StaticTeamPage.svelte';
  import {
    compareDriversHref,
    comparePickerHref,
    driverHref,
    findDriver,
    findTeam,
    loadDriverSnapshot,
    loadJson,
    loadTeamSnapshot,
    parseStaticQuery,
    resolvePit,
    teamHref,
    type StaticEntityRoute,
    type StaticLoadedState,
    type StaticPit,
    type StaticSection,
  } from '../../lib/static-client';
  import type { StaticDriverIndex, StaticTeamIndex, StaticTimeline } from '../../lib/static-data';

  interface Props {
    section: StaticSection;
  }

  let { section }: Props = $props();

  let state = $state<StaticLoadedState | null>(null);
  let error = $state<string | null>(null);

  async function loadState() {
    const route = parseStaticQuery(section, window.location.search);
    if (!route) throw new Error('Unsupported page route.');

    const timeline = await loadJson<StaticTimeline>('/_data/timeline.json');
    const pit = resolvePit(timeline, route.season, route.chain);
    if (!pit) throw new Error('Race weekend not found.');

    if (route.kind === 'driver') {
      const driverIndex = await loadJson<StaticDriverIndex>('/_data/drivers/index.json');
      const meta = findDriver(driverIndex, route.slug);
      if (!meta) throw new Error('Driver not found.');
      const snapshot = await loadDriverSnapshot(meta, pit);
      state = { route, pit, timeline, meta, snapshot };
      return;
    }

    if (route.kind === 'team') {
      const teamIndex = await loadJson<StaticTeamIndex>('/_data/teams/index.json');
      const meta = findTeam(teamIndex, route.slug);
      if (!meta) throw new Error('Team not found.');
      const snapshot = await loadTeamSnapshot(meta, pit);
      state = { route, pit, timeline, meta, snapshot };
      return;
    }

    const driverIndex = await loadJson<StaticDriverIndex>('/_data/drivers/index.json');
    if (route.kind === 'compare-picker') {
      state = { route, pit, timeline, driverIndex };
      return;
    }

    const driverA = findDriver(driverIndex, route.driverA);
    const driverB = findDriver(driverIndex, route.driverB);
    if (!driverA || !driverB) throw new Error('Driver not found.');

    const [snapshotA, snapshotB] = await Promise.all([
      loadDriverSnapshot(driverA, pit),
      loadDriverSnapshot(driverB, pit),
    ]);
    state = { route, pit, timeline, driverIndex, driverA, driverB, snapshotA, snapshotB };
  }

  onMount(() => {
    loadState().catch((err: unknown) => {
      error = err instanceof Error ? err.message : String(err);
    });
  });

  const pageTitle = $derived(() => {
    if (!state) return 'Race Rewind';
    if (state.route.kind === 'driver') return `${state.meta.full_name} - ${state.pit.subtitle}`;
    if (state.route.kind === 'team') return `${state.meta.name} - ${state.pit.subtitle}`;
    if (state.route.kind === 'compare-picker') return `Compare Drivers - ${state.pit.subtitle}`;
    return `${state.driverA.full_name} vs ${state.driverB.full_name} - ${state.pit.subtitle}`;
  });

  $effect(() => {
    if (!state) return;
    document.title = pageTitle();
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = window.location.href;
  });

  function navLinks(pit: StaticPit) {
    const raceBase = `/seasons/${pit.season}/${pit.chain}`;
    return [
      { id: 'race', href: `${raceBase}/`, label: 'Race' },
      { id: 'season', href: `${raceBase}/season/`, label: 'Season' },
      { id: 'drivers', href: `${raceBase}/drivers/`, label: 'Drivers' },
      { id: 'teams', href: `${raceBase}/teams/`, label: 'Teams' },
      { id: 'stats', href: `/stats/${pit.season}/${pit.chain}/`, label: 'Stats' },
      { id: 'compare', href: comparePickerHref(pit), label: 'Compare' },
    ];
  }

  function activeId(route: StaticEntityRoute): string {
    if (route.kind === 'driver') return 'drivers';
    if (route.kind === 'team') return 'teams';
    return 'compare';
  }

  function detailForState(current: StaticLoadedState): string {
    const { pit } = current;
    if (current.route.kind === 'driver') {
      if (pit.chain === 'preseason') return `career going into ${pit.season}`;
      if (pit.chain === 'postseason') return `career after ${pit.season}`;
      return `career as of ${pit.race?.name} ${pit.season}`;
    }
    if (current.route.kind === 'team') {
      if (pit.chain === 'preseason') return `stats going into ${pit.season}`;
      if (pit.chain === 'postseason') return `stats after ${pit.season}`;
      return `stats as of ${pit.race?.name} ${pit.season}`;
    }
    if (current.route.kind === 'compare-picker') return `choose drivers as of ${pit.subtitle}`;
    return `compared as of ${pit.subtitle}`;
  }

  function prevHref(current: StaticLoadedState): string | undefined {
    if (!current.pit.prevChain) return undefined;
    const pit = { ...current.pit, chain: current.pit.prevChain };
    if (current.route.kind === 'driver') return driverHref(current.meta.slug, pit);
    if (current.route.kind === 'team') return teamHref(current.meta.slug, pit);
    if (current.route.kind === 'compare-drivers') {
      return compareDriversHref(current.driverA.slug, current.driverB.slug, pit);
    }
    return comparePickerHref(pit);
  }

  function nextHref(current: StaticLoadedState): string | undefined {
    if (!current.pit.nextChain) return undefined;
    const pit = { ...current.pit, chain: current.pit.nextChain };
    if (current.route.kind === 'driver') return driverHref(current.meta.slug, pit);
    if (current.route.kind === 'team') return teamHref(current.meta.slug, pit);
    if (current.route.kind === 'compare-drivers') {
      return compareDriversHref(current.driverA.slug, current.driverB.slug, pit);
    }
    return comparePickerHref(pit);
  }
</script>

{#if error}
  <main class="mx-auto w-full max-w-[var(--container-narrow)] flex-1 px-4 py-8 sm:px-6">
    <h1 class="text-2xl font-bold text-fg">Page not found</h1>
    <p class="mt-2 text-fg-muted">{error}</p>
  </main>
{:else if !state}
  <main class="mx-auto w-full max-w-[var(--container-narrow)] flex-1 px-4 py-8 sm:px-6">
    <p class="text-sm text-fg-muted">Loading...</p>
  </main>
{:else}
  {@const links = navLinks(state.pit)}
  <div class="sticky top-0 z-40">
    <header class="border-b border-border bg-bg/90 backdrop-blur-sm">
      <div class="mx-auto flex h-14 max-w-[var(--container-wide)] items-center gap-4 px-4 sm:px-6">
        <a href="/" class="flex shrink-0 items-center gap-1 text-lg font-extrabold tracking-tight text-fg no-underline">
          Race <span class="text-accent">Rewind</span>
        </a>

        <nav class="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
          {#each links as link}
            <a
              href={link.href}
              class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors no-underline {link.id === activeId(state.route) ? 'bg-bg-alt text-fg' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'}"
              aria-current={link.id === activeId(state.route) ? 'page' : undefined}
            >
              {link.label}
            </a>
          {/each}
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <MobileNav {links} activeId={activeId(state.route)} />
          <ThemeToggle />
          <YearPicker seasons={state.timeline.seasons} currentSeason={state.pit.season} />
          <RacePicker
            byseason={state.timeline.byseason as Record<number, { slug: string; name: string }[]>}
            currentSeason={state.pit.season}
            currentChainSlug={state.pit.chain}
          />
        </div>
      </div>
    </header>

    <div class="border-b border-border bg-bg-alt/95 backdrop-blur-sm">
      <div class="mx-auto flex h-10 max-w-[var(--container-wide)] items-center gap-3 px-4 text-sm sm:px-6">
        <span class="font-semibold text-fg">
          {state.route.kind === 'driver'
            ? state.meta.full_name
            : state.route.kind === 'team'
              ? state.meta.name
              : state.route.kind === 'compare-drivers'
                ? `${state.driverA.full_name} vs ${state.driverB.full_name}`
                : 'Compare Drivers'}
        </span>
        <span class="hidden text-fg-muted sm:inline">- {detailForState(state)}</span>
        <div class="ml-auto flex items-center gap-1">
          {#if state.route.kind === 'driver'}
            <a
              href={comparePickerHref(state.pit, { prefill: state.meta.slug })}
              class="mr-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-fg-muted no-underline transition-colors hover:border-accent hover:text-accent"
            >
              Compare with...
            </a>
          {/if}
          {#if prevHref(state)}
            <a href={prevHref(state)} class="flex h-7 w-7 items-center justify-center rounded text-fg-muted no-underline transition-colors hover:bg-bg-hover hover:text-fg" aria-label="Previous race">‹</a>
          {/if}
          {#if nextHref(state)}
            <a href={nextHref(state)} class="flex h-7 w-7 items-center justify-center rounded text-fg-muted no-underline transition-colors hover:bg-bg-hover hover:text-fg" aria-label="Next race">›</a>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <main class="mx-auto w-full max-w-[var(--container-narrow)] flex-1 px-4 py-8 sm:px-6">
    {#if state.route.kind === 'driver'}
      <StaticDriverPage {state} />
    {:else if state.route.kind === 'team'}
      <StaticTeamPage {state} />
    {:else}
      <StaticComparePage {state} />
    {/if}
  </main>
{/if}
