<script lang="ts">
	import type { Project } from '$lib/server/db/schema';

	let {
		projects,
		initial = []
	}: {
		projects: Project[];
		initial?: { projectId: number; weight: number }[];
	} = $props();

	let weights = $state(new Map<number, number>());
	let seeded = $state(false);
	$effect(() => {
		if (!seeded && initial.length > 0) {
			weights = new Map(initial.map((a) => [a.projectId, a.weight]));
			seeded = true;
		}
	});

	const totalWeight = $derived([...weights.values()].reduce((s, w) => s + w, 0));

	function setWeight(projectId: number, value: number) {
		const next = new Map(weights);
		if (!Number.isFinite(value) || value <= 0) next.delete(projectId);
		else next.set(projectId, value);
		weights = next;
	}

	function spreadEvenly() {
		const next = new Map<number, number>();
		for (const p of projects.filter((p) => p.status === 'active')) next.set(p.id, 1);
		weights = next;
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<p class="text-xs text-fg-muted">
			Weights determine how the cost splits. They're normalized — e.g. <code>1, 1, 2</code> means 25/25/50%.
		</p>
		<button type="button" class="btn btn-ghost text-xs" onclick={spreadEvenly}>Spread evenly across active</button>
	</div>
	<div class="rounded-md border border-border divide-y divide-border">
		{#each projects as p}
			{@const w = weights.get(p.id) ?? 0}
			{@const share = totalWeight > 0 && w > 0 ? w / totalWeight : 0}
			<div class="flex items-center gap-3 px-3 py-2 {p.status !== 'active' ? 'opacity-60' : ''}">
				<div class="flex-1 min-w-0">
					<div class="text-sm font-medium truncate">{p.name}</div>
					<div class="text-xs text-fg-subtle">{p.status}</div>
				</div>
				<input
					type="number"
					name="alloc_{p.id}"
					min="0"
					step="0.5"
					value={w || ''}
					placeholder="0"
					class="input w-20 text-right tabular-nums"
					oninput={(e) => setWeight(p.id, Number((e.currentTarget as HTMLInputElement).value))}
				/>
				<div class="w-14 text-right text-xs text-fg-muted tabular-nums">
					{share > 0 ? (share * 100).toFixed(1) + '%' : '—'}
				</div>
			</div>
		{:else}
			<div class="px-3 py-4 text-sm text-fg-subtle">Create a project first to allocate to.</div>
		{/each}
	</div>
</div>
