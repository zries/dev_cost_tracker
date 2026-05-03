<script lang="ts">
	import { enhance } from '$app/forms';
	import { fmtMoneyPrecise } from '$lib/format';
	import { toast } from '$lib/toast.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = $derived(data.summary);
	const issues = $derived(data.issues);
	const yearly = $derived(s.totalMonthly * 12);
	const errorCount = $derived(issues.filter((i) => i.severity === 'error').length);
	const warnCount = $derived(issues.filter((i) => i.severity === 'warning').length);

	const integrations = $derived(data.integrations);
	const liveTotal = $derived(
		integrations.reduce((sum, i) => sum + (i.snapshot?.actualAmount ?? 0), 0)
	);
	const liveProjected = $derived(
		integrations.reduce((sum, i) => sum + (i.snapshot?.projectedAmount ?? 0), 0)
	);

	function fmtRelative(unixSec: number | undefined | null): string {
		if (!unixSec) return '—';
		const diff = Math.floor(Date.now() / 1000) - unixSec;
		if (diff < 60) return `${diff}s ago`;
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}
</script>

<svelte:head><title>Dashboard · devcost</title></svelte:head>

<div class="mb-6">
	<h1 class="text-xl font-semibold">Dashboard</h1>
	<p class="text-sm text-fg-muted">
		{s.activeProjects} active project{s.activeProjects === 1 ? '' : 's'} · {s.activeCosts} active cost{s.activeCosts === 1 ? '' : 's'}
	</p>
</div>

<div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
	<div class="card card-body bg-bg-muted">
		<div class="text-xs text-fg-subtle">Total monthly</div>
		<div class="text-2xl font-semibold tabular-nums text-accent">{fmtMoneyPrecise(s.totalMonthly)}</div>
		<div class="text-xs text-fg-muted mt-1">{fmtMoneyPrecise(yearly)} / year</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Global</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(s.globalMonthly)}</div>
		<div class="text-xs text-fg-muted">spread across all active</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Shared</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(s.sharedMonthly)}</div>
		<div class="text-xs text-fg-muted">weighted across selected</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Tag</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(s.tagMonthly)}</div>
		<div class="text-xs text-fg-muted">spread by tag match</div>
	</div>
	<div class="card card-body">
		<div class="text-xs text-fg-subtle">Project-specific</div>
		<div class="text-lg font-semibold tabular-nums">{fmtMoneyPrecise(s.projectMonthly)}</div>
		<div class="text-xs text-fg-muted">tied to one project</div>
	</div>
</div>

{#if integrations.length > 0}
	<div class="card mb-6">
		<div class="card-header">
			<h2 class="font-medium">Live usage</h2>
			<div class="flex items-center gap-3">
				<span class="text-xs text-fg-muted tabular-nums">
					MTD <strong class="text-fg-base">{fmtMoneyPrecise(liveTotal)}</strong>
					· projected <strong class="text-fg-base">{fmtMoneyPrecise(liveProjected)}</strong>
				</span>
				<form
					method="POST"
					action="?/refreshAll"
					use:enhance={() => async ({ result, update }) => {
						if (result.type === 'redirect') toast.success('All integrations refreshed.');
						else if (result.type === 'failure') toast.error((result.data as { error?: string } | undefined)?.error ?? 'Refresh failed.');
						await update();
					}}
				>
					<button type="submit" class="btn btn-ghost text-xs">Refresh all</button>
				</form>
			</div>
		</div>
		<table class="table">
			<thead>
				<tr>
					<th>Cost</th>
					<th>Provider</th>
					<th class="text-right">Actual MTD</th>
					<th class="text-right">Projected</th>
					<th class="text-right">Configured</th>
					<th class="text-right">Δ</th>
					<th>Refreshed</th>
				</tr>
			</thead>
			<tbody>
				{#each integrations as i}
					{@const snap = i.snapshot}
					{@const delta = snap && snap.status === 'ok' ? snap.projectedAmount - i.costMonthly : 0}
					<tr>
						<td>
							<a href="/costs/{i.costId}" class="font-medium hover:text-accent">{i.costName}</a>
							{#if i.costVendor}<div class="text-xs text-fg-subtle">{i.costVendor}</div>{/if}
						</td>
						<td><span class="badge badge-shared">{i.providerLabel}</span></td>
						<td class="text-right tabular-nums">
							{#if snap && snap.status === 'ok'}{fmtMoneyPrecise(snap.actualAmount, snap.currency)}
							{:else}<span class="text-fg-subtle">—</span>{/if}
						</td>
						<td class="text-right tabular-nums">
							{#if snap && snap.status === 'ok'}{fmtMoneyPrecise(snap.projectedAmount, snap.currency)}
							{:else}<span class="text-fg-subtle">—</span>{/if}
						</td>
						<td class="text-right tabular-nums text-fg-muted">{fmtMoneyPrecise(i.costMonthly, i.costCurrency)}</td>
						<td class="text-right tabular-nums {delta > 0 ? 'text-danger' : 'text-fg-muted'}">
							{#if snap && snap.status === 'ok'}
								{delta > 0 ? '+' : ''}{fmtMoneyPrecise(delta, snap.currency)}
							{:else}—{/if}
						</td>
						<td class="text-xs text-fg-muted">
							{#if snap?.status === 'error'}
								<span class="text-danger" title={snap.message ?? ''}>error</span>
							{:else}
								{fmtRelative(snap?.fetchedAt)}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if issues.length > 0}
	<div class="card mb-6 border-danger/40">
		<div class="card-header border-danger/30">
			<h2 class="font-medium flex items-center gap-2">
				<span class="inline-block w-2 h-2 rounded-full bg-danger"></span>
				Cost integrity issues
			</h2>
			<span class="text-xs text-fg-muted">
				{errorCount} error{errorCount === 1 ? '' : 's'}{warnCount > 0 ? ` · ${warnCount} warning${warnCount === 1 ? '' : 's'}` : ''}
			</span>
		</div>
		<table class="table">
			<thead>
				<tr>
					<th>Cost</th>
					<th>Issue</th>
					<th>Scope</th>
					<th class="text-right">Monthly</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each issues as i}
					<tr class={i.active ? '' : 'opacity-60'}>
						<td>
							{#if i.costId > 0}
								<a href="/costs/{i.costId}" class="font-medium hover:text-accent">{i.costName}</a>
							{:else}
								<span class="font-medium">{i.costName}</span>
							{/if}
							{#if !i.active}<span class="text-xs text-fg-subtle ml-1">(inactive)</span>{/if}
						</td>
						<td>
							<span class="badge {i.severity === 'error' ? 'text-danger border-danger/40 bg-danger/10' : 'badge-tag'}">
								{i.severity}
							</span>
							<span class="text-sm text-fg-muted ml-2">{i.message}</span>
						</td>
						<td><span class="badge badge-{i.scope}">{i.scope}</span></td>
						<td class="text-right tabular-nums text-fg-muted">
							{i.monthly > 0 ? fmtMoneyPrecise(i.monthly, i.currency) : '—'}
						</td>
						<td class="text-right">
							{#if i.costId > 0}
								<a href="/costs/{i.costId}" class="btn btn-ghost text-xs">Fix</a>
							{:else if i.type === 'global_no_active_projects'}
								<a href="/projects" class="btn btn-ghost text-xs">Projects</a>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<div class="card">
	<div class="card-header">
		<h2 class="font-medium">By project</h2>
		<a href="/projects" class="text-xs text-fg-muted hover:text-fg-base">Manage →</a>
	</div>
	<table class="table">
		<thead>
			<tr>
				<th>Project</th>
				<th>Status</th>
				<th class="text-right">Direct</th>
				<th class="text-right">Shared</th>
				<th class="text-right">Global</th>
				<th class="text-right">Tag</th>
				<th class="text-right">Total / mo</th>
				<th class="text-right">Year</th>
			</tr>
		</thead>
		<tbody>
			{#each s.perProject as r}
				<tr>
					<td><a href="/projects/{r.project.id}" class="font-medium hover:text-accent">{r.project.name}</a></td>
					<td><span class="badge {r.project.status === 'active' ? 'badge-shared' : ''}">{r.project.status}</span></td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(r.directMonthly)}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(r.sharedMonthly)}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(r.globalMonthly)}</td>
					<td class="text-right tabular-nums">{fmtMoneyPrecise(r.tagMonthly)}</td>
					<td class="text-right tabular-nums font-semibold">{fmtMoneyPrecise(r.totalMonthly)}</td>
					<td class="text-right tabular-nums text-fg-muted">{fmtMoneyPrecise(r.totalMonthly * 12)}</td>
				</tr>
			{:else}
				<tr><td colspan="8" class="text-center text-fg-subtle py-8">
					No projects yet — <a href="/projects" class="text-accent hover:underline">create one</a> to start tracking.
				</td></tr>
			{/each}
		</tbody>
	</table>
</div>
