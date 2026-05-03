<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { toast } from '$lib/toast.svelte';

	type VersionInfo = {
		current: string;
		currentShort: string;
		latest: string | null;
		latestShort: string | null;
		updateAvailable: boolean;
		compareUrl: string | null;
		mode: 'display' | 'oneclick';
		repo: string;
	};

	let info = $state<VersionInfo | null>(null);
	let dismissed = $state(false);
	let updating = $state(false);
	let copied = $state(false);

	let pollTimer: ReturnType<typeof setInterval> | undefined;
	let postUpdateTimer: ReturnType<typeof setInterval> | undefined;

	const POLL_MS = 15 * 60 * 1000; // every 15 min

	async function check(force = false) {
		try {
			const res = await fetch(`/api/version${force ? '?force=1' : ''}`);
			if (!res.ok) return;
			info = await res.json();
		} catch {
			// network error, swallow
		}
	}

	function dismiss() {
		dismissed = true;
		try {
			sessionStorage.setItem('devcost-update-dismissed', info?.latest ?? '');
		} catch {
			// sessionStorage may be unavailable; not critical
		}
	}

	function pctExecCommand(): string {
		// Best-effort guess. If user uses a different CTID we can't know — show a generic version.
		return `pct exec <CTID> -- bash /opt/devcost/deploy/install.sh`;
	}

	async function copyCommand() {
		try {
			await navigator.clipboard.writeText(pctExecCommand());
			copied = true;
			setTimeout(() => (copied = false), 1800);
		} catch {
			toast.error('Could not copy to clipboard.');
		}
	}

	async function startUpdate() {
		if (updating) return;
		if (!confirm('Update now? The app will restart and the page will reload when it comes back up.')) return;
		updating = true;
		const before = info?.current;
		try {
			const res = await fetch('/api/update', { method: 'POST' });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				toast.error(`Update failed: ${data.reason ?? res.statusText}`);
				updating = false;
				return;
			}
			toast.success('Update started — waiting for restart…');
		} catch {
			toast.error('Could not contact the updater.');
			updating = false;
			return;
		}

		// Poll /api/health until the SHA flips, then reload.
		let attempts = 0;
		postUpdateTimer = setInterval(async () => {
			attempts++;
			try {
				const r = await fetch('/api/health', { cache: 'no-store' });
				if (r.ok) {
					const h = (await r.json()) as { sha: string };
					if (h.sha && h.sha !== before) {
						clearInterval(postUpdateTimer);
						toast.success('Update complete — reloading…');
						setTimeout(() => location.reload(), 700);
					}
				}
			} catch {
				// expected during the restart window
			}
			if (attempts > 60) {
				// 5 min max
				clearInterval(postUpdateTimer);
				updating = false;
				toast.error("Update didn't complete in 5 minutes — check journalctl on the host.");
			}
		}, 5000);
	}

	onMount(() => {
		check();
		pollTimer = setInterval(() => check(), POLL_MS);
		try {
			const last = sessionStorage.getItem('devcost-update-dismissed');
			if (last && info && last === info.latest) dismissed = true;
		} catch {
			// ignore
		}
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		if (postUpdateTimer) clearInterval(postUpdateTimer);
	});

	const visible = $derived(!!info && info.updateAvailable && !dismissed);
</script>

{#if visible && info}
	<div class="update-banner" transition:fade={{ duration: 150 }} role="status">
		<div class="flex-1 flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
			<span class="font-medium">Update available</span>
			<code class="text-xs text-fg-muted">
				{info.currentShort} → {info.latestShort}
			</code>
			{#if info.compareUrl}
				<a
					href={info.compareUrl}
					target="_blank"
					rel="noopener"
					class="text-xs text-accent hover:underline"
				>
					what changed ↗
				</a>
			{/if}
		</div>

		<div class="flex items-center gap-2 flex-shrink-0">
			{#if info.mode === 'oneclick'}
				<button
					type="button"
					class="btn btn-primary text-xs"
					disabled={updating}
					onclick={startUpdate}
				>
					{updating ? 'Updating…' : 'Update now'}
				</button>
			{:else}
				<button
					type="button"
					class="btn btn-ghost text-xs"
					onclick={copyCommand}
					title="Run this on your Proxmox host"
				>
					{copied ? 'Copied!' : 'Copy update command'}
				</button>
			{/if}
			<button
				type="button"
				class="text-fg-subtle hover:text-fg-base text-sm leading-none px-1"
				onclick={dismiss}
				aria-label="Dismiss"
			>×</button>
		</div>
	</div>
{/if}
