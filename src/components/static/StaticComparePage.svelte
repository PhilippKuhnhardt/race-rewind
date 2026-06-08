<script lang="ts">
  import DriverPickerForm from '../compare/DriverPickerForm.svelte';
  import { formatPts } from '../../lib/format';
  import { compareStatRows, raceHref, type StaticLoadedState } from '../../lib/static-client';

  type CompareState = Extract<
    StaticLoadedState,
    { route: { kind: 'compare-picker' } } | { route: { kind: 'compare-drivers' } }
  >;

  interface Props {
    state: CompareState;
  }

  let { state }: Props = $props();
</script>

{#if state.route.kind === 'compare-picker'}
  <div class="mb-8 border-b border-border pb-6">
    <h1 class="text-3xl font-bold tracking-tight text-fg sm:text-4xl">Compare Drivers</h1>
    <p class="mt-2 text-lg text-fg-muted">{state.pit.subtitle}</p>
  </div>
  <DriverPickerForm
    season={state.pit.season}
    chain={state.pit.chain}
    drivers={state.driverIndex.drivers}
    prefillA={state.route.prefill}
  />
{:else}
  <div class="mb-4">
    <a href={raceHref(state.pit)} class="text-sm text-fg-muted transition-colors hover:text-accent">
      ← {state.pit.subtitle}
    </a>
  </div>
  <div class="mb-6">
    <h1 class="text-2xl font-bold text-fg">
      {state.driverA.full_name} <span class="font-normal text-fg-muted">vs</span>
      {state.driverB.full_name}
    </h1>
    <p class="mt-1 text-sm text-fg-muted">Career stats - {state.pit.subtitle}</p>
  </div>
  <div class="mb-6">
    <DriverPickerForm
      season={state.pit.season}
      chain={state.pit.chain}
      drivers={state.driverIndex.drivers}
      prefillA={state.driverA.slug}
      prefillB={state.driverB.slug}
      autoNavigate
    />
  </div>
  <div class="space-y-4">
    <div class="overflow-hidden rounded-lg border border-border">
      <div class="grid grid-cols-3 border-b border-border">
        <div class="truncate bg-bg-alt p-3 text-center text-sm font-semibold">{state.driverA.full_name}</div>
        <div class="border-x border-border bg-bg-alt p-3 text-center text-xs font-semibold uppercase tracking-wide text-fg-muted">Career going in</div>
        <div class="truncate bg-bg-alt p-3 text-center text-sm font-semibold">{state.driverB.full_name}</div>
      </div>
      <div class="divide-y divide-border">
        {#each compareStatRows as row}
          {@const valA = state.snapshotA.career_going_in[row.key] as number}
          {@const valB = state.snapshotB.career_going_in[row.key] as number}
          <div class="grid grid-cols-3 text-sm">
            <div class="px-3 py-2.5 text-right tabular-nums {valA > valB ? 'font-bold text-accent' : 'text-fg'}">
              {row.key === 'points' ? formatPts(valA) : valA}
            </div>
            <div class="border-x border-border px-3 py-2.5 text-center text-xs text-fg-muted">{row.label}</div>
            <div class="px-3 py-2.5 tabular-nums {valB > valA ? 'font-bold text-accent' : 'text-fg'}">
              {row.key === 'points' ? formatPts(valB) : valB}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}
