<script lang="ts">
	import type { PageData, ActionData } from './$types';
	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Account · devcost</title></svelte:head>

<div class="max-w-md">
	<h1 class="text-xl font-semibold mb-1">Account</h1>
	<p class="text-sm text-fg-muted mb-4">Signed in as <strong class="text-fg-base">{data.user.username}</strong></p>

	{#if data.first}
		<div class="card border-accent/40 bg-accent/5 mb-4">
			<div class="card-body text-sm">
				Welcome — please change the default password before using the app.
			</div>
		</div>
	{/if}

	<div class="card">
		<div class="card-header"><h2 class="font-medium">Change password</h2></div>
		<form method="POST" class="card-body space-y-3">
			<div>
				<label for="current" class="label">Current password</label>
				<input id="current" name="current" type="password" autocomplete="current-password" required class="input" />
			</div>
			<div>
				<label for="next" class="label">New password</label>
				<input id="next" name="next" type="password" autocomplete="new-password" minlength="8" required class="input" />
			</div>
			<div>
				<label for="confirm" class="label">Confirm new password</label>
				<input id="confirm" name="confirm" type="password" autocomplete="new-password" minlength="8" required class="input" />
			</div>
			{#if form?.error}
				<p class="text-sm text-danger">{form.error}</p>
			{/if}
			{#if form?.success}
				<p class="text-sm text-success">Password updated.</p>
			{/if}
			<button type="submit" class="btn btn-primary">Update password</button>
		</form>
	</div>
</div>
