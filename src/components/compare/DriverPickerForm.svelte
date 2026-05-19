<script lang="ts">
  import DriverCombobox from './DriverCombobox.svelte';
  import type { DriverPickerEntry } from '../../lib/api-types';

  interface Props {
    season: number;
    raceSlug: string;
    drivers: DriverPickerEntry[];
    prefill?: string;
  }

  let { season, raceSlug, drivers, prefill }: Props = $props();

  let driverASlug = $state(prefill ?? '');
  let driverBSlug = $state('');

  const canCompare = $derived(driverASlug.length > 0 && driverBSlug.length > 0);

  function compare() {
    if (!canCompare) return;
    window.location.href = `/compare/${driverASlug}/${driverBSlug}/${season}/${raceSlug}/`;
  }
</script>

<div class="rounded-lg border border-border bg-bg-alt p-4">
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
    <DriverCombobox label="Driver A" {drivers} value={driverASlug} onselect={(s) => (driverASlug = s)} />
    <DriverCombobox label="Driver B" {drivers} value={driverBSlug} onselect={(s) => (driverBSlug = s)} />
  </div>
  <button
    onclick={compare}
    disabled={!canCompare}
    class="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
  >
    Compare
  </button>
</div>
