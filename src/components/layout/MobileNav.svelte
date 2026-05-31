<script lang="ts">
  import { Dialog } from 'bits-ui';

  interface Props {
    links: { id: string; href: string; label: string }[];
    activeId?: string;
  }

  let { links, activeId }: Props = $props();

  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger
    class="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors md:hidden"
    aria-label="Open navigation menu"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="18" x2="20" y2="18"/>
    </svg>
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <Dialog.Content
      class="fixed right-0 top-0 z-50 flex h-full w-56 flex-col bg-bg shadow-2xl border-l border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300"
    >
      <div class="flex items-center justify-between border-b border-border px-4 py-3">
        <span class="font-semibold text-fg">Menu</span>
        <Dialog.Close
          class="flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-bg-hover hover:text-fg transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </Dialog.Close>
      </div>

      <nav class="flex-1 overflow-y-auto py-2" aria-label="Primary">
        {#each links as link}
          {@const isActive = link.id === activeId}
          <a
            href={link.href}
            onclick={() => { open = false; }}
            class="flex items-center px-4 py-2.5 text-sm font-medium transition-colors {isActive ? 'bg-bg-alt text-accent' : 'text-fg hover:bg-bg-hover'}"
            aria-current={isActive ? 'page' : undefined}
          >
            {link.label}
          </a>
        {/each}
      </nav>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
