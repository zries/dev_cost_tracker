<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import Toaster from '$lib/components/Toaster.svelte';
	import UpdateBanner from '$lib/components/UpdateBanner.svelte';
	import type { LayoutData } from './$types';

	let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();

	const nav = [
		{ href: '/', label: 'Dashboard' },
		{ href: '/projects', label: 'Projects' },
		{ href: '/costs', label: 'Costs' },
		{ href: '/tags', label: 'Tags' }
	];

	function isActive(href: string, path: string): boolean {
		if (href === '/') return path === '/';
		return path === href || path.startsWith(href + '/');
	}
</script>

{#if data.user && !$page.url.pathname.startsWith('/login')}
	<div class="min-h-full flex flex-col">
		<UpdateBanner />
		<header class="border-b border-border bg-bg-subtle">
			<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
				<div class="flex items-center gap-8">
					<a href="/" class="flex items-center gap-2 font-semibold text-fg-base">
						<span class="inline-block w-6 h-6 rounded bg-accent text-accent-fg grid place-items-center text-xs font-bold">D</span>
						<span>devcost</span>
					</a>
					<nav class="flex items-center gap-1">
						{#each nav as item}
							<a
								href={item.href}
								class="px-3 py-1.5 text-sm rounded-md transition-colors {isActive(item.href, data.path)
									? 'bg-bg-muted text-fg-base'
									: 'text-fg-muted hover:text-fg-base hover:bg-bg-muted'}"
							>
								{item.label}
							</a>
						{/each}
					</nav>
				</div>
				<div class="flex items-center gap-3">
					<a href="/account" class="text-sm text-fg-muted hover:text-fg-base">{data.user.username}</a>
					<form method="POST" action="/logout" class="contents">
						<button type="submit" class="btn btn-ghost text-fg-muted text-xs">Sign out</button>
					</form>
				</div>
			</div>
		</header>
		<main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
			{@render children()}
		</main>
		<footer class="border-t border-border text-xs text-fg-subtle py-3 text-center">
			devcost · self-hosted dev cost tracker
		</footer>
	</div>
{:else}
	{@render children()}
{/if}

<Toaster />
