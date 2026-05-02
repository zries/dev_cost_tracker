<script lang="ts">
	import { fmtMoneyPrecise } from '$lib/format';
	import AllocationEditor from '$lib/components/AllocationEditor.svelte';
	import TagPicker from '$lib/components/TagPicker.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let showNew = $state(false);
	let scope = $state<'global' | 'shared' | 'project' | 'tag'>('global');
	let billing = $state<'monthly' | 'yearly' | 'one_time'>('monthly');
	let amount = $state(0);

	const monthlyPreview = $derived(
		billing === 'monthly' ? amount : billing === 'yearly' ? amount / 12 : 0
	);

	const tagsById = $derived(new Map(data.tags.map((t) => [t.id, t])));
</script>

<svelte:head><title>Costs · devcost</title></svelte:head>

<div class="flex items-center justify-between mb-4">
	<div>
		<h1 class="text-xl font-semibold">Costs</h1>
		<p class="text-sm text-fg-muted">Subscriptions, services, and one-off charges across your projects.</p>
	</div>
	<button class="btn btn-primary" onclick={() => (showNew = !showNew)}>
		{showNew ? 'Cancel' : '+ New cost'}
	</button>
</div>

{#if showNew}
	<div class="card mb-4">
		<div class="card-header"><h2 class="font-medium">New cost</h2></div>
		<form method="POST" action="?/create" class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3">
			<div class="sm:col-span-3">
				<label for="name" class="label">Name</label>
				<input id="name" name="name" type="text" required class="input" placeholder="Claude Max, Vercel Pro, …" />
			</div>
			<div class="sm:col-span-3">
				<label for="vendor" class="label">Vendor</label>
				<input id="vendor" name="vendor" type="text" class="input" placeholder="Anthropic, Vercel, …" />
			</div>
			<div class="sm:col-span-6">
				<label for="url" class="label">URL <span class="text-fg-subtle font-normal">(optional, e.g. billing dashboard)</span></label>
				<input id="url" name="url" type="url" class="input" placeholder="https://…" />
			</div>

			<div class="sm:col-span-2">
				<label for="amount" class="label">Amount</label>
				<input
					id="amount" name="amount" type="number" step="0.01" min="0" required class="input text-right tabular-nums"
					bind:value={amount}
				/>
			</div>
			<div class="sm:col-span-2">
				<label for="currency" class="label">Currency</label>
				<input id="currency" name="currency" type="text" maxlength="3" value="USD" class="input uppercase" />
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
					<option value="global">Global — split across all active projects</option>
					<option value="shared">Shared — weighted across selected</option>
					<option value="project">Project — single project</option>
					<option value="tag">Tag — split across projects with matching tags</option>
				</select>
			</div>
			<div class="sm:col-span-4 flex items-end text-xs text-fg-muted">
				Monthly equivalent: <strong class="text-fg-base ml-1 tabular-nums">{fmtMoneyPrecise(monthlyPreview)}</strong>
			</div>

			{#if scope === 'project'}
				<div class="sm:col-span-6">
					<label for="project_id" class="label">Project</label>
					<select id="project_id" name="project_id" class="select" required>
						<option value="">Select…</option>
						{#each data.projects as p}
							<option value={p.id}>{p.name}</option>
						{/each}
					</select>
				</div>
			{:else if scope === 'shared'}
				<div class="sm:col-span-6">
					<div class="label">Allocation across projects</div>
					<AllocationEditor projects={data.projects} />
				</div>
			{:else if scope === 'tag'}
				<div class="sm:col-span-6">
					<div class="label">Tags (cost spreads equally across active projects matching any of these)</div>
					<TagPicker tags={data.tags} />
				</div>
			{/if}

			<div class="sm:col-span-6">
				<label for="notes" class="label">Notes</label>
				<textarea id="notes" name="notes" rows="2" class="textarea"></textarea>
			</div>

			{#if form?.error}
				<p class="text-sm text-danger sm:col-span-6">{form.error}</p>
			{/if}
			<div class="sm:col-span-6 flex justify-end">
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
				<th>Vendor</th>
				<th>Scope</th>
				<th>Cycle</th>
				<th class="text-right">Amount</th>
				<th class="text-right">Monthly</th>
				<th>Status</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.costs as c}
				<tr class={c.active ? '' : 'opacity-60'}>
					<td>
						<div class="flex items-center gap-1.5">
							<a href="/costs/{c.id}" class="text-fg-base hover:text-accent font-medium">{c.name}</a>
							{#if c.url}
								<a href={c.url} target="_blank" rel="noopener" class="text-fg-subtle hover:text-accent text-xs" title={c.url}>↗</a>
							{/if}
						</div>
						{#if c.notes}<div class="text-xs text-fg-subtle truncate max-w-md">{c.notes}</div>{/if}
						{#if c.scope === 'tag' && c.tagIds.length > 0}
							<div class="flex flex-wrap gap-1 mt-1">
								{#each c.tagIds as tid}
									{@const t = tagsById.get(tid)}
									{#if t}
										<span class="chip chip-readonly">{t.name}</span>
									{/if}
								{/each}
							</div>
						{/if}
					</td>
					<td class="text-fg-muted">{c.vendor ?? '—'}</td>
					<td><span class="badge badge-{c.scope}">{c.scope}</span></td>
					<td class="text-fg-muted text-xs">{c.billingCycle.replace('_', '-')}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(c.amount, c.currency)}</td>
					<td class="text-right tabular-nums font-medium">{fmtMoneyPrecise(c.monthlyAmount, c.currency)}</td>
					<td>
						<form method="POST" action="?/toggleActive" class="contents">
							<input type="hidden" name="id" value={c.id} />
							<input type="hidden" name="active" value={c.active ? '0' : '1'} />
							<button type="submit" class="badge {c.active ? 'badge-shared' : ''}">
								{c.active ? 'active' : 'inactive'}
							</button>
						</form>
					</td>
					<td class="text-right">
						<form method="POST" action="?/delete" class="inline">
							<input type="hidden" name="id" value={c.id} />
							<button
								type="submit"
								class="btn btn-ghost btn-danger text-xs"
								onclick={(e) => { if (!confirm(`Delete cost "${c.name}"?`)) e.preventDefault(); }}
							>Delete</button>
						</form>
					</td>
				</tr>
			{:else}
				<tr><td colspan="8" class="text-center text-fg-subtle py-8">No costs yet — add one above.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
