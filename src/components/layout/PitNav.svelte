<script lang="ts">
  import type { RaceNavEntry } from '../../lib/queries/races';
  import MobileNav from './MobileNav.svelte';
  import RacePicker from './RacePicker.svelte';
  import ThemeToggle from '../primitives/ThemeToggle.svelte';
  import YearPicker from './YearPicker.svelte';

  type Section = 'seasons' | 'stats';
  type NavLink = { id: string; href: string; label: string };
  type SavedRace = { kind: 'race'; season: number; raceSlug: string };
  type SavedBoundary = { kind: 'preseason' | 'postseason'; season: number };
  type SavedPit = SavedRace | SavedBoundary;
  type NavOverride = {
    season: number;
    chainSlug: string;
    raceSlug?: string;
    compareSlug?: string;
  };

  interface Props {
    byseason: Record<number, RaceNavEntry[]>;
    seasons: number[];
    currentSeason: number;
    currentRaceSlug?: string;
    currentChainSlug?: string;
    compareSlug?: string;
    section?: Section;
    activeId?: string;
    allowSavedPitOverride?: boolean;
  }

  let {
    byseason,
    seasons,
    currentSeason,
    currentRaceSlug,
    currentChainSlug = '',
    compareSlug,
    section = 'seasons',
    activeId,
    allowSavedPitOverride = false,
  }: Props = $props();

  let savedPitOverride = $state<NavOverride | null>(null);
  let savedPitChecked = $state(false);

  const effectiveSeason = $derived(savedPitOverride?.season ?? currentSeason);
  const effectiveChainSlug = $derived(savedPitOverride?.chainSlug ?? currentChainSlug);
  const effectiveRaceSlug = $derived(savedPitOverride?.raceSlug ?? currentRaceSlug);
  const effectiveCompareSlug = $derived(savedPitOverride?.compareSlug ?? compareSlug);
  const ready = $derived(!allowSavedPitOverride || savedPitChecked);

  function isSavedPit(value: unknown): value is SavedPit {
    if (typeof value !== 'object' || value === null) return false;
    const data = value as Record<string, unknown>;
    if (typeof data.season !== 'number') return false;
    if (data.kind === 'race') return typeof data.raceSlug === 'string';
    return data.kind === 'preseason' || data.kind === 'postseason';
  }

  function hasSeason(season: number): boolean {
    return seasons.includes(season);
  }

  function hasRace(season: number, slug: string): boolean {
    return (byseason[season] ?? []).some((race) => race.slug === slug);
  }

  function applySavedPit(saved: SavedPit): void {
    if (!hasSeason(saved.season)) return;

    if (saved.kind === 'race') {
      if (!hasRace(saved.season, saved.raceSlug)) return;
      savedPitOverride = {
        season: saved.season,
        chainSlug: saved.raceSlug,
        raceSlug: saved.raceSlug,
        compareSlug: saved.raceSlug,
      };
      return;
    }

    savedPitOverride = {
      season: saved.season,
      chainSlug: saved.kind,
      raceSlug: saved.kind,
      compareSlug: saved.kind,
    };
  }

  $effect(() => {
    if (!allowSavedPitOverride) return;
    try {
      const raw = localStorage.getItem('lastRace');
      if (!raw) {
        savedPitChecked = true;
        return;
      }
      const saved: unknown = JSON.parse(raw);
      if (isSavedPit(saved)) {
        applySavedPit(saved);
      } else {
        localStorage.removeItem('lastRace');
      }
      savedPitChecked = true;
    } catch {
      try {
        localStorage.removeItem('lastRace');
      } catch {
        // ignore storage failures
      }
      savedPitChecked = true;
    }
  });

  const navSlug = $derived(
    effectiveChainSlug === 'preseason' || effectiveChainSlug === 'postseason'
      ? effectiveChainSlug
      : effectiveRaceSlug,
  );
  const raceBase = $derived(navSlug ? `/seasons/${effectiveSeason}/${navSlug}` : '');
  const statsBase = $derived(
    effectiveChainSlug ? `/stats/${effectiveSeason}/${effectiveChainSlug}/` : '/stats/',
  );
  const compareHref = $derived(
    effectiveCompareSlug ? `/compare/${effectiveSeason}/${effectiveCompareSlug}/` : '/compare/',
  );
  const navLinks: NavLink[] = $derived([
    { id: 'race', href: raceBase ? `${raceBase}/` : '/', label: 'Race' },
    { id: 'season', href: raceBase ? `${raceBase}/season/` : '/', label: 'Season' },
    { id: 'drivers', href: raceBase ? `${raceBase}/drivers/` : '/', label: 'Drivers' },
    { id: 'teams', href: raceBase ? `${raceBase}/teams/` : '/', label: 'Teams' },
    { id: 'stats', href: statsBase, label: 'Stats' },
    { id: 'compare', href: compareHref, label: 'Compare' },
  ]);
</script>

<nav class:invisible={!ready} class="ml-6 hidden items-center gap-1 md:flex" aria-label="Primary">
  {#each navLinks as link}
    {@const active = link.id === activeId}
    <a
      href={link.href}
      class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors no-underline {active ? 'bg-bg-alt text-fg' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'}"
      aria-current={active ? 'page' : undefined}
    >
      {link.label}
    </a>
  {/each}
</nav>

<div class:invisible={!ready} class="ml-auto flex items-center gap-1">
  <MobileNav links={navLinks} {activeId} />
  <ThemeToggle />
  <YearPicker {seasons} currentSeason={effectiveSeason} {section} />
  <RacePicker
    {byseason}
    currentSeason={effectiveSeason}
    currentChainSlug={effectiveChainSlug}
    {section}
  />
</div>
