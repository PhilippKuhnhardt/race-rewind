<script lang="ts">
  import { Dialog } from 'bits-ui';

  interface Props {
    seasons: number[];
    currentSeason: number;
    section?: 'seasons' | 'stats';
  }

  let { seasons, currentSeason, section = 'seasons' }: Props = $props();

  let open = $state(false);

  const sortedSeasons = $derived([...seasons].sort((a, b) => b - a));
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger
    class="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-fg hover:bg-bg-hover transition-colors"
    aria-label="Pick season"
  >
    {currentSeason}
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <Dialog.Content
      class="fixed right-0 top-0 z-50 flex h-full w-56 flex-col bg-bg shadow-2xl border-l border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
    >
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

      <nav class="flex-1 overflow-y-auto py-2" aria-label="Seasons">
        {#each sortedSeasons as season}
          {@const isActive = season === currentSeason}
          <a
            href={section === 'stats' ? `/stats/${season}/preseason/` : `/seasons/${season}/preseason/`}
            onclick={() => { open = false; }}
            class="flex items-center px-4 py-2.5 text-sm font-medium transition-colors {isActive ? 'bg-bg-alt text-accent' : 'text-fg hover:bg-bg-hover'}"
            aria-current={isActive ? 'page' : undefined}
          >
            {season}
          </a>
        {/each}
      </nav>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
