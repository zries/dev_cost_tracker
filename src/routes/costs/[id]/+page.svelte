<script lang="ts">
	import { untrack } from 'svelte';
	import { fmtMoneyPrecise } from '$lib/format';
	import AllocationEditor from '$lib/components/AllocationEditor.svelte';
	import TagPicker from '$lib/components/TagPicker.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const c = $derived(data.cost);
	let scope = $state(untrack(() => data.cost.scope));
	let billing = $state(untrack(() => data.cost.billingCycle));
	let amount = $state(untrack(() => data.cost.amount));

	const monthlyPreview = $derived(
		billing === 'monthly' ? amount : billing === 'yearly' ? amount / 12 : 0
	);

	const initialAllocations = $derived(
		data.allocations.map((a) => ({ projectId: a.projectId, weight: a.weight }))
	);
	const projectScopeProjectId = $derived(data.allocations[0]?.projectId);
</script>

<svelte:head><title>{c.name} · devcost</title></svelte:head>

<div class="mb-4">
	<a href="/costs" class="text-xs text-fg-subtle hover:text-fg-base">← Costs</a>
	<h1 class="text-xl font-semibold mt-1 flex items-center gap-2">
		{c.name}
		<span class="badge badge-{c.scope}">{c.scope}</span>
		{#if !c.active}<span class="badge">inactive</span>{/if}
	</h1>
</div>

<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Amount</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(c.amount, c.currency)}</div>
		<div class="text-xs text-fg-muted">per {c.billingCycle.replace('_', '-')}</div>
	</div>
	<div class="card card-body bg-bg-muted">
		<div class="text-xs text-fg-subtle">Monthly</div>
		<div class="text-lg font-semibold tabular-nums text-accent">{fmtMoneyPrecise(c.monthlyAmount, c.currency)}</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Vendor</div>
		<div class="text-sm font-medium">{c.vendor ?? '—'}</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Currency</div>
		<div class="text-sm font-medium">{c.currency}</div>
	</div>
</div>

<div class="card">
	<div class="card-header"><h2 class="font-medium">Edit cost</h2></div>
	<form method="POST" action="?/update" class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3">
		<div class="sm:col-span-3">
			<label for="name" class="label">Name</label>
			<input id="name" name="name" type="text" required class="input" value={c.name} />
		</div>
		<div class="sm:col-span-3">
			<label for="vendor" class="label">Vendor</label>
			<input id="vendor" name="vendor" type="text" class="input" value={c.vendor ?? ''} />
		</div>

		<div class="sm:col-span-2">
			<label for="amount" class="label">Amount</label>
			<input id="amount" name="amount" type="number" step="0.01" min="0" required class="input text-right tabular-nums" bind:value={amount} />
		</div>
		<div class="sm:col-span-2">
			<label for="currency" class="label">Currency</label>
			<input id="currency" name="currency" type="text" maxlength="3" class="input uppercase" value={c.currency} />
		</div>
		<div class="sm:col-span-2">
			<label for="billing_cycle" class="label">Billing cycle</label>
			<select id="billing_cycle" name="billing_cycle" class="select" bind:value={billing}>
				<option value="monthly">Monthly</option>
				<option value="yearly">Yearly</option>
				<option value="one_time">One-time</option>
			</select>
		</div>

		<div class="sm:col-span-2">
			<label for="scope" class="label">Scope</label>
			<select id="scope" name="scope" class="select" bind:value={scope}>
				<option value="global">Global</option>
				<option value="shared">Shared</option>
				<option value="project">Project</option>
				<option value="tag">Tag</option>
			</select>
		</div>
		<div class="sm:col-span-2 flex items-end text-xs text-fg-muted">
			Monthly equivalent: <strong class="text-fg-base ml-1 tabular-nums">{fmtMoneyPrecise(monthlyPreview, c.currency)}</strong>
		</div>
		<label class="sm:col-span-2 flex items-end gap-2 text-sm">
			<input type="checkbox" name="active" checked={c.active} class="form-checkbox rounded border-border-strong bg-bg-subtle text-accent focus:ring-accent" />
			Active
		</label>

		{#if scope === 'project'}
			<div class="sm:col-span-6">
				<label for="project_id" class="label">Project</label>
				<select id="project_id" name="project_id" class="select" required>
					<option value="">Select…</option>
					{#each data.projects as p}
						<option value={p.id} selected={p.id === projectScopeProjectId}>{p.name}</option>
					{/each}
				</select>
			</div>
		{:else if scope === 'shared'}
			<div class="sm:col-span-6">
				<div class="label">Allocation across projects</div>
				<AllocationEditor projects={data.projects} initial={initialAllocations} />
			</div>
		{:else if scope === 'tag'}
			<div class="sm:col-span-6">
				<div class="label">Tags (cost spreads equally across active projects matching any of these)</div>
				<TagPicker tags={data.tags} initial={data.tagIds} />
			</div>
		{/if}

		<div class="sm:col-span-6">
			<label for="notes" class="label">Notes</label>
			<textarea id="notes" name="notes" rows="3" class="textarea">{c.notes ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="text-sm text-danger sm:col-span-6">{form.error}</p>
		{/if}

		<div class="sm:col-span-6 flex justify-between">
			<button
				type="submit"
				formaction="?/delete"
				class="btn btn-danger"
				onclick={(e) => { if (!confirm(`Delete cost "${c.name}"?`)) e.preventDefault(); }}
			>Delete</button>
			<button type="submit" class="btn btn-primary">Save</button>
		</div>
	</form>
</div>
