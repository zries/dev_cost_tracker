import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

export type UpdaterMode = 'display' | 'oneclick';

const HELPER_PATH = '/usr/local/sbin/devcost-update';
const REPO_SLUG = process.env.GITHUB_REPO_SLUG ?? 'zries/dev_cost_tracker';
const REPO_BRANCH = process.env.GITHUB_REPO_BRANCH ?? 'main';

export function getMode(): UpdaterMode {
	const v = (process.env.UPDATER_MODE ?? 'display').toLowerCase();
	if (v === 'oneclick' && existsSync(HELPER_PATH)) return 'oneclick';
	return 'display';
}

export function getRepoSlug(): string {
	return REPO_SLUG;
}

export function getRepoBranch(): string {
	return REPO_BRANCH;
}

export function getCurrentSha(): string {
	return __BUILD_SHA__;
}

export function getBuildTime(): string {
	return __BUILD_TIME__;
}

let cache: { sha: string | null; fetchedAt: number; failed: boolean } = {
	sha: null,
	fetchedAt: 0,
	failed: false
};
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

export async function getLatestSha(force = false): Promise<{
	sha: string | null;
	fetchedAt: number;
	stale: boolean;
}> {
	const now = Date.now();
	if (!force && cache.sha && now - cache.fetchedAt < CACHE_TTL_MS) {
		return { sha: cache.sha, fetchedAt: cache.fetchedAt, stale: false };
	}
	try {
		const res = await fetch(
			`https://api.github.com/repos/${REPO_SLUG}/commits/${REPO_BRANCH}`,
			{
				headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'devcost-updater' },
				signal: AbortSignal.timeout(8000)
			}
		);
		if (!res.ok) throw new Error(`GitHub API ${res.status}`);
		const data = (await res.json()) as { sha?: string };
		if (!data.sha) throw new Error('no sha in response');
		cache = { sha: data.sha, fetchedAt: now, failed: false };
		return { sha: data.sha, fetchedAt: now, stale: false };
	} catch {
		cache.failed = true;
		// serve stale on failure if we have anything cached
		return {
			sha: cache.sha,
			fetchedAt: cache.fetchedAt,
			stale: cache.sha !== null
		};
	}
}

let inProgress = false;

export function isInProgress(): boolean {
	return inProgress;
}

/**
 * Spawns the helper script via sudo, detaches, and returns immediately.
 * The helper is responsible for: backup → git fetch → npm ci → npm run build → systemctl restart.
 * Once systemctl restart fires, this process gets killed mid-response — frontend should expect that.
 */
export function triggerUpdate(): { ok: true } | { ok: false; reason: string } {
	if (getMode() !== 'oneclick') {
		return { ok: false, reason: 'Updater is in display mode. One-click is not enabled.' };
	}
	if (inProgress) {
		return { ok: false, reason: 'An update is already running.' };
	}
	if (!existsSync(HELPER_PATH)) {
		return { ok: false, reason: `Helper script ${HELPER_PATH} is missing.` };
	}
	inProgress = true;
	try {
		const child = spawn('sudo', ['-n', HELPER_PATH], {
			detached: true,
			stdio: 'ignore'
		});
		child.unref();
		// Best-effort reset; in practice the systemctl restart will kill us first.
		setTimeout(() => {
			inProgress = false;
		}, 5 * 60 * 1000);
		return { ok: true };
	} catch (err) {
		inProgress = false;
		return { ok: false, reason: err instanceof Error ? err.message : 'spawn failed' };
	}
}
