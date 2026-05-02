<script lang="ts">
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editingId = $state<number | null>(null);

	const grouped = $derived.by(() => {
		const map = new Map<string, typeof data.tags>();
		for (const t of data.tags) {
			if (!map.has(t.category)) map.set(t.category, []);
			map.get(t.category)!.push(t);
		}
		return [...map.entries()];
	});
</script>

<svelte:head><title>Tags · devcost</title></svelte:head>

<div class="mb-4">
	<h1 class="text-xl font-semibold">Tags</h1>
	<p class="text-sm text-fg-muted">
		Tags classify projects and drive tag-scoped cost allocation. Deleting a tag removes it from any project or cost it was attached to.
	</p>
</div>

<div class="card mb-4">
	<div class="card-header"><h2 class="font-medium">New tag</h2></div>
	<form method="POST" action="?/create" class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3">
		<div class="sm:col-span-3">
			<label for="name" class="label">Name</label>
			<input id="name" name="name" type="text" required maxlength="60" class="input" placeholder="e.g. Tailwind, Inertia, GraphQL" />
		</div>
		<div class="sm:col-span-3">
			<label for="category" class="label">Category</label>
			<input
				id="category"
				name="category"
				type="text"
				required
				maxlength="40"
				class="input"
				list="categories"
				placeholder="Pick existing or type a new one"
			/>
			<datalist id="categories">
				{#each data.categories as c}
					<option value={c}></option>
				{/each}
			</datalist>
		</div>
		{#if form?.error}
			<p class="text-sm text-danger sm:col-span-6">{form.error}</p>
		{/if}
		<div class="sm:col-span-6 flex justify-end">
			<button type="submit" class="btn btn-primary">Create tag</button>
		</div>
	</form>
</div>

<div class="space-y-4">
	{#each grouped as [category, items]}
		<div class="card">
			<div class="card-header">
				<h2 class="font-medium">{category}</h2>
				<span class="text-xs text-fg-subtle">{items.length} tag{items.length === 1 ? '' : 's'}</span>
			</div>
			<table class="table">
				<thead>
					<tr>
						<th>Name</th>
						<th class="text-right">Projects</th>
						<th class="text-right">Costs</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each items as t}
						{#if editingId === t.id}
							<tr>
								<td colspan="4">
									<form method="POST" action="?/rename" class="flex flex-wrap items-center gap-2 py-1">
										<input type="hidden" name="id" value={t.id} />
										<input name="name" type="text" required maxlength="60" value={t.name} class="input flex-1 min-w-[10rem]" />
										<input name="category" type="text" required maxlength="40" value={t.category} class="input flex-1 min-w-[10rem]" list="categories" />
										<button type="submit" class="btn btn-primary text-xs">Save</button>
										<button type="button" class="btn btn-ghost text-xs" onclick={() => (editingId = null)}>Cancel</button>
									</form>
								</td>
							</tr>
						{:else}
							<tr>
								<td class="font-medium">{t.name}</td>
								<td class="text-right tabular-nums text-fg-muted">{t.projectCount}</td>
								<td class="text-right tabular-nums text-fg-muted">{t.costCount}</td>
								<td class="text-right whitespace-nowrap">
									<button type="button" class="btn btn-ghost text-xs" onclick={() => (editingId = t.id)}>Edit</button>
									<form method="POST" action="?/delete" class="inline">
										<input type="hidden" name="id" value={t.id} />
										<button
											type="submit"
											class="btn btn-ghost btn-danger text-xs"
											onclick={(e) => {
												const refs = t.projectCount + t.costCount;
												const msg = refs > 0
													? `Delete tag "${t.name}"? It is used by ${t.projectCount} project(s) and ${t.costCount} cost(s).`
													: `Delete tag "${t.name}"?`;
												if (!confirm(msg)) e.preventDefault();
											}}
										>Delete</button>
									</form>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="card card-body text-center text-fg-subtle">No tags yet.</div>
	{/each}
</div>
