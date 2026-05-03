import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

function gitSha(): string {
	try {
		return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return 'unknown';
	}
}

function gitTime(): string {
	try {
		return execSync('git log -1 --format=%cI', { stdio: ['ignore', 'pipe', 'ignore'] })
			.toString()
			.trim();
	} catch {
		return new Date().toISOString();
	}
}

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: false
	},
	define: {
		__BUILD_SHA__: JSON.stringify(gitSha()),
		__BUILD_TIME__: JSON.stringify(gitTime())
	}
});
