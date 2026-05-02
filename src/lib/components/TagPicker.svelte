<script lang="ts">
	import { untrack } from 'svelte';
	import type { Tag } from '$lib/server/db/schema';

	let {
		tags,
		initial = [],
		name = 'tag_ids',
		placeholder = 'Search tags…'
	}: {
		tags: Tag[];
		initial?: number[];
		name?: string;
		placeholder?: string;
	} = $props();

	let selected = $state(new Set<number>(untrack(() => initial)));
	let query = $state('');
	let open = $state(false);

	const grouped = $derived.by(() => {
		const map = new Map<string, Tag[]>();
		for (const t of tags) {
			if (!map.has(t.category)) map.set(t.category, []);
			map.get(t.category)!.push(t);
		}
		for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return grouped;
		return grouped
			.map(([cat, arr]) => [cat, arr.filter((t) => t.name.toLowerCase().includes(q))] as const)
			.filter(([, arr]) => arr.length > 0);
	});

	const selectedTags = $derived(tags.filter((t) => selected.has(t.id)));

	function toggle(id: number) {
		const next = new Set(selected);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selected = next;
	}

	function remove(id: number) {
		const next = new Set(selected);
		next.delete(id);
		selected = next;
	}
</script>

<div class="space-y-2">
	{#if selectedTags.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each selectedTags as t}
				<button
					type="button"
					class="chip chip-selected"
					onclick={() => remove(t.id)}
					title="Remove {t.name}"
				>
					<span class="text-fg-subtle text-[10px] uppercase tracking-wide">{t.category}</span>
					<span>{t.name}</span>
					<span class="text-fg-subtle">×</span>
				</button>
			{/each}
		</div>
	{/if}

	<div class="relative">
		<input
			type="text"
			class="input"
			{placeholder}
			bind:value={query}
			onfocus={() => (open = true)}
			onblur={() => setTimeout(() => (open = false), 150)}
		/>
		{#if open}
			<div class="absolute z-10 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-border-strong bg-bg-subtle shadow-lg">
				{#if filtered.length === 0}
					<div class="px-3 py-2 text-sm text-fg-subtle">No matches.</div>
				{:else}
					{#each filtered as [cat, arr]}
						<div class="px-3 py-1 text-[10px] uppercase tracking-wide text-fg-subtle bg-bg-muted/50 sticky top-0">
							{cat}
						</div>
						{#each arr as t}
							{@const isOn = selected.has(t.id)}
							<button
								type="button"
								class="w-full text-left px-3 py-1.5 text-sm hover:bg-bg-muted flex items-center gap-2 {isOn ? 'text-accent' : 'text-fg-base'}"
								onmousedown={(e) => { e.preventDefault(); toggle(t.id); }}
							>
								<span class="w-3 text-center">{isOn ? '✓' : ''}</span>
								<span>{t.name}</span>
							</button>
						{/each}
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	{#each [...selected] as id}
		<input type="hidden" {name} value={id} />
	{/each}
</div>
