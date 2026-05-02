import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({ out: 'build' }),
		// LAN-only self-hosted app: accessed by raw IP or hostname which may change
		// after a DHCP lease renewal, so SvelteKit's strict Origin check creates
		// brittleness with no real security gain (auth + private network).
		csrf: { checkOrigin: false }
	}
};

export default config;
