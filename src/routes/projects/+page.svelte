<script lang="ts">
	import { fmtMoneyPrecise } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showNew = $state(false);
</script>

<svelte:head><title>Projects · devcost</title></svelte:head>

<div class="flex items-center justify-between mb-4">
	<div>
		<h1 class="text-xl font-semibold">Projects</h1>
		<p class="text-sm text-fg-muted">Each project rolls up direct, shared, and global costs.</p>
	</div>
	<button class="btn btn-primary" onclick={() => (showNew = !showNew)}>
		{showNew ? 'Cancel' : '+ New project'}
	</button>
</div>

{#if showNew}
	<div class="card mb-4">
		<div class="card-header"><h2 class="font-medium">New project</h2></div>
		<form method="POST" action="?/create" class="card-body grid grid-cols-1 sm:grid-cols-2 gap-3">
			<div class="sm:col-span-2">
				<label for="name" class="label">Name</label>
				<input id="name" name="name" type="text" required class="input" />
			</div>
			<div>
				<label for="status" class="label">Status</label>
				<select id="status" name="status" class="select">
					<option value="active">Active</option>
					<option value="paused">Paused</option>
					<option value="archived">Archived</option>
				</select>
			</div>
			<div class="sm:col-span-2">
				<label for="notes" class="label">Notes</label>
				<textarea id="notes" name="notes" rows="2" class="textarea"></textarea>
			</div>
			{#if form?.error}
				<p class="text-sm text-danger sm:col-span-2">{form.error}</p>
			{/if}
			<div class="sm:col-span-2 flex justify-end">
				<button type="submit" class="btn btn-primary">Create</button>
			</div>
		</form>
	</div>
{/if}

<div class="card">
	<table class="table">
		<thead>
			<tr>
				<th>Name</th>
				<th>Status</th>
				<th class="text-right">Direct</th>
				<th class="text-right">Shared</th>
				<th class="text-right">Global</th>
				<th class="text-right">Total / mo</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.projects as p}
				<tr>
					<td>
						<a href="/projects/{p.id}" class="text-fg-base hover:text-accent font-medium">{p.name}</a>
						{#if p.notes}
							<div class="text-xs text-fg-subtle truncate max-w-md">{p.notes}</div>
						{/if}
					</td>
					<td>
						<span class="badge {p.status === 'active' ? 'badge-shared' : ''}">{p.status}</span>
					</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(p.directMonthly)}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(p.sharedMonthly)}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(p.globalMonthly)}</td>
					<td class="text-right tabular-nums font-semibold">{fmtMoneyPrecise(p.totalMonthly)}</td>
					<td class="text-right">
						<form method="POST" action="?/delete" class="inline">
							<input type="hidden" name="id" value={p.id} />
							<button
								type="submit"
								class="btn btn-ghost btn-danger text-xs"
								onclick={(e) => { if (!confirm(`Delete project "${p.name}"? Allocations to it will be removed.`)) e.preventDefault(); }}
							>Delete</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="7" class="text-center text-fg-subtle py-8">No projects yet — create one to start.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
