<script lang="ts">
	import { fmtMoneyPrecise, fmtPercent } from '$lib/format';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let editing = $state(false);

	const r = $derived(data.rollup);
</script>

<svelte:head><title>{r.project.name} · devcost</title></svelte:head>

<div class="flex items-center justify-between mb-4">
	<div>
		<a href="/projects" class="text-xs text-fg-subtle hover:text-fg-base">← Projects</a>
		<h1 class="text-xl font-semibold mt-1 flex items-center gap-2">
			{r.project.name}
			<span class="badge {r.project.status === 'active' ? 'badge-shared' : ''}">{r.project.status}</span>
		</h1>
		{#if r.project.notes}<p class="text-sm text-fg-muted mt-1">{r.project.notes}</p>{/if}
	</div>
	<button class="btn" onclick={() => (editing = !editing)}>{editing ? 'Cancel' : 'Edit'}</button>
</div>

{#if editing}
	<div class="card mb-4">
		<div class="card-header"><h2 class="font-medium">Edit project</h2></div>
		<form method="POST" action="?/update" class="card-body grid grid-cols-1 sm:grid-cols-2 gap-3">
			<div class="sm:col-span-2">
				<label for="name" class="label">Name</label>
				<input id="name" name="name" type="text" required class="input" value={r.project.name} />
			</div>
			<div>
				<label for="status" class="label">Status</label>
				<select id="status" name="status" class="select">
					<option value="active" selected={r.project.status === 'active'}>Active</option>
					<option value="paused" selected={r.project.status === 'paused'}>Paused</option>
					<option value="archived" selected={r.project.status === 'archived'}>Archived</option>
				</select>
			</div>
			<div class="sm:col-span-2">
				<label for="notes" class="label">Notes</label>
				<textarea id="notes" name="notes" rows="3" class="textarea">{r.project.notes ?? ''}</textarea>
			</div>
			{#if form?.error}
				<p class="text-sm text-danger sm:col-span-2">{form.error}</p>
			{/if}
			<div class="sm:col-span-2 flex justify-end">
				<button type="submit" class="btn btn-primary">Save</button>
			</div>
		</form>
		<div class="card-body border-t border-border">
			<form method="POST" action="?/delete">
				<button
					type="submit"
					class="btn btn-danger"
					onclick={(e) => { if (!confirm(`Delete project "${r.project.name}"?`)) e.preventDefault(); }}
				>Delete project</button>
			</form>
		</div>
	</div>
{/if}

<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Direct</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(r.directMonthly)}</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Shared</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(r.sharedMonthly)}</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Global</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(r.globalMonthly)}</div>
	</div>
	<div class="card card-body bg-bg-muted">
		<div class="text-xs text-fg-subtle">Total / month</div>
		<div class="text-lg font-semibold tabular-nums text-accent">{fmtMoneyPrecise(r.totalMonthly)}</div>
	</div>
</div>

<div class="card">
	<div class="card-header"><h2 class="font-medium">Cost breakdown</h2></div>
	<table class="table">
		<thead>
			<tr>
				<th>Cost</th>
				<th>Vendor</th>
				<th>Scope</th>
				<th class="text-right">Share</th>
				<th class="text-right">Monthly</th>
			</tr>
		</thead>
		<tbody>
			{#each r.lines as l}
				<tr>
					<td><a href="/costs/{l.costId}" class="hover:text-accent">{l.name}</a></td>
					<td class="text-fg-muted">{l.vendor ?? '—'}</td>
					<td><span class="badge badge-{l.scope}">{l.scope}</span></td>
					<td class="text-right tabular-nums text-fg-muted">{fmtPercent(l.share)}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(l.amount)}</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="text-center text-fg-subtle py-8">No costs allocated to this project yet.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
