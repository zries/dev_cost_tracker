import { json } from '@sveltejs/kit';
import {
	getCurrentSha,
	getBuildTime,
	getLatestSha,
	getMode,
	getRepoSlug,
	getRepoBranch
} from '$lib/server/updater';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });

	const force = url.searchParams.get('force') === '1';
	const current = getCurrentSha();
	const latest = await getLatestSha(force);

	const updateAvailable =
		latest.sha !== null && current !== 'unknown' && latest.sha !== current;

	const repo = getRepoSlug();
	const branch = getRepoBranch();
	const compareUrl =
		updateAvailable && current !== 'unknown'
			? `https://github.com/${repo}/compare/${current}...${latest.sha}`
			: null;

	return json({
		current,
		currentShort: current.slice(0, 7),
		buildTime: getBuildTime(),
		latest: latest.sha,
		latestShort: latest.sha?.slice(0, 7) ?? null,
		latestFetchedAt: latest.fetchedAt,
		latestStale: latest.stale,
		updateAvailable,
		compareUrl,
		mode: getMode(),
		repo,
		branch
	});
};
