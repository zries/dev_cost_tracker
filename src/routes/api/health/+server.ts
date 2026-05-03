import { json } from '@sveltejs/kit';
import { getCurrentSha } from '$lib/server/updater';
import type { RequestHandler } from './$types';

/**
 * Liveness check. Public — used by the update banner to detect when the new
 * process is back up after a restart. Returns the build SHA so the client
 * can confirm it's talking to the new version, not an in-flight old one.
 */
export const GET: RequestHandler = async () => {
	return json({ ok: true, sha: getCurrentSha(), at: Date.now() });
};
