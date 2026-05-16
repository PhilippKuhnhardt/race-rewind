<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { RaceNavEntry } from '../../lib/queries/races';

  interface Props {
    seasons: number[];
    byseason: Record<number, RaceNavEntry[]>;
    currentSeason: number;
    currentRaceSlug: string | undefined;
  }

  let { seasons, byseason, currentSeason, currentRaceSlug }: Props = $props();

  let open = $state(false);
  // Snapshot the prop on mount — viewingSeason is mutable local state (user can switch seasons in drawer)
  const initSeason = currentSeason;
  let viewingSeason = $state(initSeason);

  const sortedSeasons = $derived([...seasons].sort((a, b) => b - a));
  const seasonRaces = $derived(byseason[viewingSeason] ?? []);
</script>

<!-- Trigger button -->
<Dialog.Root bind:open>
  <Dialog.Trigger
    class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-fg hover:bg-bg-hover transition-colors"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="md:hidden"
      aria-hidden="true"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
    <span class="hidden md:inline">{viewingSeason}</span>
    <span class="hidden md:inline text-fg-muted font-normal">Season</span>
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <Dialog.Content
      class="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[90vw] flex-col bg-bg shadow-2xl border-l border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
    >
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <span class="font-semibold text-fg">Season</span>
        <Dialog.Close
          class="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </Dialog.Close>
      </div>

      <!-- Season selector -->
      <div class="border-b border-border px-4 py-3">
        <select
          bind:value={viewingSeason}
          class="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {#each sortedSeasons as season}
            <option value={season}>{season}</option>
          {/each}
        </select>
      </div>

      <!-- Race list -->
      <nav class="flex-1 overflow-y-auto py-2" aria-label="Season rounds">
        <a
          href="/seasons/{viewingSeason}/preseason/"
          onclick={() => { open = false; }}
          class="flex items-center gap-3 px-4 py-2 text-sm text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
        >
          <span class="w-6 text-right text-xs text-fg-muted/60">—</span>
          <span class="font-medium">Start of season</span>
        </a>

        {#each seasonRaces as race, i}
          {@const isActive = viewingSeason === currentSeason && race.slug === currentRaceSlug}
          <a
            href="/seasons/{viewingSeason}/{race.slug}/"
            onclick={() => { open = false; }}
            class="flex items-center gap-3 px-4 py-2 text-sm transition-colors {isActive ? 'bg-bg-alt font-semibold text-accent' : 'text-fg hover:bg-bg-hover'}"
            aria-current={isActive ? 'page' : undefined}
          >
            <span class="w-6 text-right text-xs tabular-nums text-fg-muted">{i + 1}</span>
            <span>{race.name.replace(/ Grand Prix$/, '')}</span>
          </a>
        {/each}

        <a
          href="/seasons/{viewingSeason}/postseason/"
          onclick={() => { open = false; }}
          class="flex items-center gap-3 px-4 py-2 text-sm text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
        >
          <span class="w-6 text-right text-xs text-fg-muted/60">—</span>
          <span class="font-medium">End of season</span>
        </a>
      </nav>

      <!-- Footer actions -->
      <div class="border-t border-border px-4 py-3">
        <a
          href="/seasons/{viewingSeason}/"
          onclick={() => { open = false; }}
          class="block w-full rounded-md bg-accent px-3 py-2 text-center text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          Go to {viewingSeason} season
        </a>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
