<script lang="ts">
	import { fmtMoneyPrecise } from '$lib/format';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	const s = $derived(data.summary);
	const issues = $derived(data.issues);
	const yearly = $derived(s.totalMonthly * 12);
	const errorCount = $derived(issues.filter((i) => i.severity === 'error').length);
	const warnCount = $derived(issues.filter((i) => i.severity === 'warning').length);
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
