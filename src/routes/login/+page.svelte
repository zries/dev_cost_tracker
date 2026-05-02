<script lang="ts">
	import type { ActionData } from './$types';
	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Sign in · devcost</title></svelte:head>

<div class="min-h-screen grid place-items-center px-4">
	<div class="card w-full max-w-sm">
		<div class="card-header">
			<div class="flex items-center gap-2">
				<span class="inline-block w-7 h-7 rounded bg-accent text-accent-fg grid place-items-center text-sm font-bold">D</span>
				<span class="font-semibold">devcost</span>
			</div>
			<span class="text-xs text-fg-subtle">v0.1</span>
		</div>
		<form method="POST" class="card-body space-y-4">
			<div>
				<label for="username" class="label">Username</label>
				<input
					id="username"
					name="username"
					type="text"
					autocomplete="username"
					value={form?.username ?? ''}
					required
					class="input"
				/>
			</div>
			<div>
				<label for="password" class="label">Password</label>
				<input id="password" name="password" type="password" autocomplete="current-password" required class="input" />
			</div>
			{#if form?.error}
				<p class="text-sm text-danger">{form.error}</p>
			{/if}
			<button type="submit" class="btn btn-primary w-full">Sign in</button>
			<p class="text-xs text-fg-subtle text-center">
				Default credentials: <code class="text-fg-muted">admin / admin</code> — change after first login.
			</p>
		</form>
	</div>
</div>
