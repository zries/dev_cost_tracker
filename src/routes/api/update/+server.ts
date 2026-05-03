import { json } from '@sveltejs/kit';
import { triggerUpdate, getMode, isInProgress } from '$lib/server/updater';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	if (!locals.user) return new Response('Unauthorized', { status: 401 });
	if (getMode() !== 'oneclick') {
		return json({ ok: false, reason: 'one-click updater not enabled' }, { status: 400 });
	}
	if (isInProgress()) {
		return json({ ok: false, reason: 'update already running' }, { status: 409 });
	}
	const result = triggerUpdate();
	if (!result.ok) {
		return json(result, { status: 500 });
	}
	return json({ ok: true, message: 'Update started.' }, { status: 202 });
};
