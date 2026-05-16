<script lang="ts">
  import { Combobox } from 'bits-ui';
  import type { DriverPickerEntry } from '../../lib/api-types';

  interface Props {
    label: string;
    drivers: DriverPickerEntry[];
    value: string;
    onselect: (slug: string) => void;
  }

  let { label, drivers, value, onselect }: Props = $props();

  let inputValue = $state('');
  let open = $state(false);

  const selected = $derived(drivers.find((d) => d.slug === value));

  $effect(() => {
    if (selected) inputValue = selected.full_name;
  });

  const filtered = $derived(
    inputValue && !selected
      ? drivers.filter((d) => d.full_name.toLowerCase().includes(inputValue.toLowerCase()))
      : drivers,
  );
</script>

<div class="flex flex-col gap-1">
  <span class="text-xs font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
  <Combobox.Root
    type="single"
    bind:value
    bind:open
    {inputValue}
    items={drivers.map((d) => ({ value: d.slug, label: d.full_name }))}
    onValueChange={(v) => { if (v) onselect(v as string); }}
  >
    <div class="relative">
      <Combobox.Input
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:ring-2 focus:ring-accent/40"
        placeholder="Search driver…"
        oninput={(e) => { inputValue = (e.target as HTMLInputElement).value; }}
      />
    </div>
    <Combobox.Content
      class="z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-bg shadow-lg"
      sideOffset={4}
    >
      {#if filtered.length === 0}
        <div class="px-3 py-2 text-sm text-fg-muted">No drivers found</div>
      {:else}
        {#each filtered.slice(0, 100) as driver (driver.slug)}
          <Combobox.Item
            value={driver.slug}
            label={driver.full_name}
            class="cursor-pointer px-3 py-2 text-sm text-fg hover:bg-bg-hover data-[highlighted]:bg-bg-hover data-[selected]:text-accent"
          >
            <span>{driver.full_name}</span>
            {#if driver.nationality}
              <span class="ml-1 text-xs text-fg-muted">{driver.nationality}</span>
            {/if}
          </Combobox.Item>
        {/each}
      {/if}
    </Combobox.Content>
  </Combobox.Root>
</div>
