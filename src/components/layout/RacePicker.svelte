<script lang="ts">
  import { Dialog } from 'bits-ui';
  import type { RaceNavEntry } from '../../lib/queries/races';
  import { emojify, raceFlag } from '../../lib/ui/emojify';

  interface Props {
    byseason: Record<number, RaceNavEntry[]>;
    currentSeason: number;
    currentChainSlug: string;
    section?: 'seasons' | 'stats';
  }

  let { byseason, currentSeason, currentChainSlug, section = 'seasons' }: Props = $props();

  function href(slug: string): string {
    return section === 'stats'
      ? `/stats/${currentSeason}/${slug}/`
      : slug === 'preseason' || slug === 'postseason'
        ? `/seasons/${currentSeason}/${slug}/`
        : `/seasons/${currentSeason}/${slug}/`;
  }

  let open = $state(false);

  const seasonRaces = $derived(byseason[currentSeason] ?? []);

  const triggerLabel = $derived(() => {
    if (currentChainSlug === 'preseason') return 'Start of season';
    if (currentChainSlug === 'postseason') return 'End of season';
    const race = seasonRaces.find((r) => r.slug === currentChainSlug);
    return race ? emojify(race.name.replace(/ Grand Prix$/, ' GP')) : 'Race';
  });

  const triggerFlag = $derived(() => {
    if (currentChainSlug === 'preseason' || currentChainSlug === 'postseason') return '🏁';
    const race = seasonRaces.find((r) => r.slug === currentChainSlug);
    return (race && raceFlag(race.name)) || '🏁';
  });
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger
    class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-fg hover:bg-bg-hover transition-colors"
    aria-label="Pick race"
  >
    <span class="sm:hidden text-base leading-none">{triggerFlag()}</span>
    <span class="hidden sm:inline max-w-[14ch] truncate">{triggerLabel()}</span>
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <Dialog.Content
      class="fixed right-0 top-0 z-50 flex h-full w-80 max-w-[90vw] flex-col bg-bg shadow-2xl border-l border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <span class="font-semibold text-fg">{currentSeason} Rounds</span>
        <Dialog.Close
          class="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </Dialog.Close>
      </div>

      <nav class="flex-1 overflow-y-auto py-2" aria-label="Season rounds">
        <a
          href={href('preseason')}
          onclick={() => { open = false; }}
          class="flex items-center gap-3 px-4 py-2 text-sm transition-colors {currentChainSlug === 'preseason' ? 'bg-bg-alt font-semibold text-accent' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'}"
          aria-current={currentChainSlug === 'preseason' ? 'page' : undefined}
        >
          <span class="w-6 text-right text-xs text-fg-muted/60">—</span>
          <span class="font-medium">Start of season</span>
        </a>

        {#each seasonRaces as race, i}
          <a
            href={href(race.slug)}
            onclick={() => { open = false; }}
            class="flex items-center gap-3 px-4 py-2 text-sm transition-colors {race.slug === currentChainSlug ? 'bg-bg-alt font-semibold text-accent' : 'text-fg hover:bg-bg-hover'}"
            aria-current={race.slug === currentChainSlug ? 'page' : undefined}
          >
            <span class="w-6 text-right text-xs tabular-nums text-fg-muted">{i + 1}</span>
            <span>{emojify(race.name)}</span>
          </a>
        {/each}

        <a
          href={href('postseason')}
          onclick={() => { open = false; }}
          class="flex items-center gap-3 px-4 py-2 text-sm transition-colors {currentChainSlug === 'postseason' ? 'bg-bg-alt font-semibold text-accent' : 'text-fg-muted hover:bg-bg-hover hover:text-fg'}"
          aria-current={currentChainSlug === 'postseason' ? 'page' : undefined}
        >
          <span class="w-6 text-right text-xs text-fg-muted/60">—</span>
          <span class="font-medium">End of season</span>
        </a>
      </nav>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
