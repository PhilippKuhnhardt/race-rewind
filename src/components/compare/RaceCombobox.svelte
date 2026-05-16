<script lang="ts">
  import { Combobox } from 'bits-ui';
  import type { RacePickerEntry } from '../../lib/api-types';

  interface Props {
    races: RacePickerEntry[];
    value: string;
    onselect: (season: number, slug: string) => void;
  }

  let { races, value, onselect }: Props = $props();

  let inputValue = $state('');
  let open = $state(false);

  const selected = $derived(races.find((r) => `${r.season}-${r.slug}` === value));

  $effect(() => {
    if (selected) inputValue = `${selected.season} ${selected.name}`;
  });

  const filtered = $derived(
    inputValue && !selected
      ? races.filter((r) => `${r.season} ${r.name}`.toLowerCase().includes(inputValue.toLowerCase()))
      : races,
  );
</script>

<div class="flex flex-col gap-1">
  <span class="text-xs font-semibold uppercase tracking-wide text-fg-muted">Race</span>
  <Combobox.Root
    type="single"
    bind:value
    bind:open
    {inputValue}
    items={races.map((r) => ({ value: `${r.season}-${r.slug}`, label: `${r.season} ${r.name}` }))}
    onValueChange={(v) => {
      if (!v) return;
      const key = v as string;
      const dashIdx = key.indexOf('-');
      const season = Number(key.slice(0, dashIdx));
      const slug = key.slice(dashIdx + 1);
      onselect(season, slug);
    }}
  >
    <div class="relative">
      <Combobox.Input
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        placeholder="Search race…"
        oninput={(e) => { inputValue = (e.target as HTMLInputElement).value; }}
      />
    </div>
    <Combobox.Content
      class="z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-bg shadow-lg"
      sideOffset={4}
    >
      {#if filtered.length === 0}
        <div class="px-3 py-2 text-sm text-fg-muted">No races found</div>
      {:else}
        {#each filtered.slice(0, 100) as race (`${race.season}-${race.slug}`)}
          <Combobox.Item
            value={`${race.season}-${race.slug}`}
            label={`${race.season} ${race.name}`}
            class="cursor-pointer px-3 py-2 text-sm text-fg hover:bg-bg-hover data-[highlighted]:bg-bg-hover data-[selected]:text-accent"
          >
            <span>{race.season} {race.name}</span>
          </Combobox.Item>
        {/each}
      {/if}
    </Combobox.Content>
  </Combobox.Root>
</div>
