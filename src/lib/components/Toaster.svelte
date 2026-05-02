<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { toastState, toast } from '$lib/toast.svelte';
</script>

<div
	class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm"
	aria-live="polite"
	aria-atomic="false"
>
	{#each toastState.items as t (t.id)}
		<div
			role="status"
			class="toast toast-{t.type} pointer-events-auto"
			in:fly={{ x: 20, duration: 180 }}
			out:fade={{ duration: 150 }}
		>
			<span class="toast-icon">
				{#if t.type === 'success'}✓{:else if t.type === 'error'}!{:else}i{/if}
			</span>
			<span class="flex-1 text-sm">{t.message}</span>
			<button
				type="button"
				class="text-fg-subtle hover:text-fg-base text-xs leading-none"
				onclick={() => toast.dismiss(t.id)}
				aria-label="Dismiss"
			>×</button>
		</div>
	{/each}
</div>
