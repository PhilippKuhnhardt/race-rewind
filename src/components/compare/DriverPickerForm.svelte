<script lang="ts">
  import DriverCombobox from './DriverCombobox.svelte';
  import type { DriverPickerEntry } from '../../lib/api-types';
  import { compareDriversHref } from '../../lib/static-client';

  interface Props {
    season: number;
    chain: string;
    drivers: DriverPickerEntry[];
    prefillA?: string;
    prefillB?: string;
    autoNavigate?: boolean;
  }

  let { season, chain, drivers, prefillA, prefillB, autoNavigate = false }: Props = $props();

  let driverASlug = $state('');
  let driverBSlug = $state('');

  const canCompare = $derived(driverASlug.length > 0 && driverBSlug.length > 0);

  $effect(() => {
    driverASlug = prefillA ?? '';
    driverBSlug = prefillB ?? '';
  });

  function compare() {
    if (!canCompare) return;
    window.location.href = compareDriversHref(driverASlug, driverBSlug, { season, chain });
  }

  $effect(() => {
    if (!autoNavigate || !driverASlug || !driverBSlug) return;
    const target = compareDriversHref(driverASlug, driverBSlug, { season, chain });
    if (target !== `${window.location.pathname}${window.location.search}`) {
      window.location.href = target;
    }
  });
</script>

<div class="rounded-lg border border-border bg-bg-alt p-4">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
    <DriverCombobox label="Driver A" {drivers} value={driverASlug} onselect={(s) => (driverASlug = s)} />
    <DriverCombobox label="Driver B" {drivers} value={driverBSlug} onselect={(s) => (driverBSlug = s)} />
  </div>
  {#if !autoNavigate}
    <button
      onclick={compare}
      disabled={!canCompare}
      class="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
    >
      Compare
    </button>
  {/if}
</div>
