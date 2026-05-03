<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { fmtMoneyPrecise } from '$lib/format';
	import { toast } from '$lib/toast.svelte';
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

	const integration = $derived(data.integration);
	const providerOpts = $derived(data.providerOptions);
	let chosenProvider = $state(untrack(() => data.providerOptions[0]?.id ?? ''));
	const chosenProviderHelp = $derived(
		providerOpts.find((p) => p.id === chosenProvider)?.keyHelp ?? ''
	);
	const chosenProviderPlaceholder = $derived(
		providerOpts.find((p) => p.id === chosenProvider)?.keyPlaceholder ?? ''
	);

	function fmtRelative(unixSec: number | undefined | null): string {
		if (!unixSec) return '—';
		const diff = Math.floor(Date.now() / 1000) - unixSec;
		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	function fmtDateRange(startUnix: number, endUnix: number): string {
		const s = new Date(startUnix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		const e = new Date(endUnix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		return `${s} – ${e}`;
	}
</script>

<svelte:head><title>{c.name} · devcost</title></svelte:head>

<div class="mb-4">
	<a href="/costs" class="text-xs text-fg-subtle hover:text-fg-base">← Costs</a>
	<h1 class="text-xl font-semibold mt-1 flex items-center gap-2">
		{c.name}
		{#if c.url}
			<a href={c.url} target="_blank" rel="noopener" class="text-fg-subtle hover:text-accent text-sm" title={c.url}>↗</a>
		{/if}
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

{#if providerOpts.length > 0}
	<div class="card mb-4">
		<div class="card-header">
			<h2 class="font-medium">Live usage integration</h2>
			{#if integration}
				<span class="badge badge-shared">{integration.providerLabel}</span>
			{:else}
				<span class="text-xs text-fg-muted">optional · pulls month-to-date spend from the vendor</span>
			{/if}
		</div>
		<div class="card-body space-y-3">
			{#if !data.cryptoConfigured}
				<p class="text-sm text-fg-muted">
					Set <code>DEVCOST_SECRET_KEY</code> in the server env (32 random bytes, hex) to enable encrypted credential storage.
				</p>
			{/if}

			{#if integration}
				{@const snap = integration.snapshot}
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<div>
						<div class="text-xs text-fg-subtle">Provider</div>
						<div class="text-sm font-medium">{integration.providerLabel}</div>
					</div>
					<div>
						<div class="text-xs text-fg-subtle">API key</div>
						<div class="text-sm font-medium tabular-nums">
							{integration.keyHint ? `•••• ${integration.keyHint}` : '—'}
						</div>
					</div>
					<div>
						<div class="text-xs text-fg-subtle">Last refreshed</div>
						<div class="text-sm font-medium">{fmtRelative(snap?.fetchedAt)}</div>
					</div>
					<div>
						<div class="text-xs text-fg-subtle">Status</div>
						<div class="text-sm font-medium">
							{#if !snap}<span class="text-fg-muted">never refreshed</span>
							{:else if snap.status === 'ok'}<span class="text-accent">live</span>
							{:else}<span class="text-danger">error</span>{/if}
						</div>
					</div>
				</div>

				{#if snap && snap.status === 'ok'}
					<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
						<div class="card card-body bg-bg-muted">
							<div class="text-xs text-fg-subtle">Actual MTD ({fmtDateRange(snap.periodStart, snap.periodEnd)})</div>
							<div class="text-lg font-semibold tabular-nums text-accent">{fmtMoneyPrecise(snap.actualAmount, snap.currency)}</div>
						</div>
						<div class="card card-body">
							<div class="text-xs text-fg-subtle">Projected (full month)</div>
							<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(snap.projectedAmount, snap.currency)}</div>
						</div>
						<div class="card card-body">
							<div class="text-xs text-fg-subtle">Configured monthly</div>
							<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(c.monthlyAmount, c.currency)}</div>
							<div class="text-xs text-fg-muted">
								{#if c.monthlyAmount > 0}
									{@const delta = snap.projectedAmount - c.monthlyAmount}
									{#if delta > 0}<span class="text-danger">+{fmtMoneyPrecise(delta, snap.currency)} over</span>
									{:else}<span class="text-fg-muted">{fmtMoneyPrecise(delta, snap.currency)} vs config</span>{/if}
								{/if}
							</div>
						</div>
					</div>

					{#if snap.breakdown.length > 0}
						<details class="text-sm">
							<summary class="text-xs text-fg-muted cursor-pointer hover:text-fg-base">Top {snap.breakdown.length} cost lines</summary>
							<table class="table mt-2">
								<tbody>
									{#each snap.breakdown as line}
										<tr>
											<td class="text-fg-muted">{line.label}</td>
											<td class="text-right tabular-nums">{fmtMoneyPrecise(line.amount, snap.currency)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</details>
					{/if}
				{:else if snap && snap.status === 'error'}
					<p class="text-sm text-danger">Last refresh failed: {snap.message ?? 'unknown error'}</p>
				{/if}

				{#if form?.integrationError}
					<p class="text-sm text-danger">{form.integrationError}</p>
				{/if}

				<div class="flex gap-2">
					<form
						method="POST"
						action="?/refreshIntegration"
						use:enhance={() => async ({ result, update }) => {
							if (result.type === 'redirect') toast.success('Usage refreshed.');
							else if (result.type === 'failure') toast.error((result.data as { integrationError?: string } | undefined)?.integrationError ?? 'Refresh failed.');
							await update();
						}}
					>
						<button type="submit" class="btn btn-primary">Refresh now</button>
					</form>
					<form
						method="POST"
						action="?/disconnectIntegration"
						use:enhance={() => async ({ result, update }) => {
							if (result.type === 'redirect') toast.success('Integration disconnected.');
							await update();
						}}
					>
						<button
							type="submit"
							class="btn btn-ghost btn-danger"
							onclick={(e) => { if (!confirm('Disconnect integration and delete stored API key?')) e.preventDefault(); }}
						>Disconnect</button>
					</form>
				</div>
			{:else}
				<form
					method="POST"
					action="?/connectIntegration"
					use:enhance={() => async ({ result, update }) => {
						if (result.type === 'redirect') toast.success('Integration connected.');
						else if (result.type === 'failure') toast.error((result.data as { integrationError?: string } | undefined)?.integrationError ?? 'Could not connect.');
						await update();
					}}
					class="grid grid-cols-1 sm:grid-cols-6 gap-3"
				>
					<div class="sm:col-span-2">
						<label for="provider" class="label">Provider</label>
						<select id="provider" name="provider" class="select" bind:value={chosenProvider}>
							{#each providerOpts as p}
								<option value={p.id}>{p.label}</option>
							{/each}
						</select>
					</div>
					<div class="sm:col-span-4">
						<label for="api_key" class="label">API key</label>
						<input
							id="api_key"
							name="api_key"
							type="password"
							autocomplete="off"
							class="input font-mono"
							placeholder={chosenProviderPlaceholder}
							required
							disabled={!data.cryptoConfigured}
						/>
					</div>
					{#if chosenProviderHelp}
						<p class="sm:col-span-6 text-xs text-fg-muted">{chosenProviderHelp}</p>
					{/if}
					{#if form?.integrationError}
						<p class="sm:col-span-6 text-sm text-danger">{form.integrationError}</p>
					{/if}
					<div class="sm:col-span-6 flex justify-end">
						<button type="submit" class="btn btn-primary" disabled={!data.cryptoConfigured}>Connect &amp; test</button>
					</div>
				</form>
			{/if}
		</div>
	</div>
{/if}

<div class="card">
	<div class="card-header"><h2 class="font-medium">Edit cost</h2></div>
	<form
		method="POST"
		action="?/update"
		use:enhance={({ submitter }) => {
			const isDelete = (submitter as HTMLButtonElement)?.formAction?.includes('/delete');
			return async ({ result, update }) => {
				if (result.type === 'redirect') {
					toast.success(isDelete ? `Cost "${c.name}" deleted.` : 'Cost updated.');
				} else if (result.type === 'failure') {
					const err = (result.data as { error?: string } | undefined)?.error ?? 'Save failed.';
					toast.error(err);
				} else if (result.type === 'error') {
					toast.error('Server error: ' + (result.error?.message ?? 'unknown'));
				}
				await update();
			};
		}}
		class="card-body grid grid-cols-1 sm:grid-cols-6 gap-3"
	>
		<div class="sm:col-span-3">
			<label for="name" class="label">Name</label>
			<input id="name" name="name" type="text" required class="input" value={c.name} />
		</div>
		<div class="sm:col-span-3">
			<label for="vendor" class="label">Vendor</label>
			<input id="vendor" name="vendor" type="text" class="input" value={c.vendor ?? ''} />
		</div>
		<div class="sm:col-span-6">
			<label for="url" class="label">URL <span class="text-fg-subtle font-normal">(optional, e.g. billing dashboard)</span></label>
			<input id="url" name="url" type="url" class="input" value={c.url ?? ''} placeholder="https://…" />
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
