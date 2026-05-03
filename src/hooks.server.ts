import type { Handle } from '@sveltejs/kit';
import { bootstrap } from '$lib/server/bootstrap';
import { getSessionUser, readSessionCookie, clearSessionCookie } from '$lib/server/auth';

await bootstrap();

const PUBLIC_ROUTES = new Set(['/login', '/api/health']);

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.user = null;
	event.locals.session = null;

	const sessionId = readSessionCookie(event.cookies);
	if (sessionId) {
		const found = getSessionUser(sessionId);
		if (found) {
			event.locals.user = found.user;
			event.locals.session = found.session;
		} else {
			clearSessionCookie(event.cookies);
		}
	}

	const path = event.url.pathname;
	const isPublic = PUBLIC_ROUTES.has(path) || path.startsWith('/_app') || path === '/favicon.svg';
	if (!event.locals.user && !isPublic) {
		const next = encodeURIComponent(path + event.url.search);
		return new Response(null, { status: 303, headers: { location: `/login?next=${next}` } });
	}

	return resolve(event);
};
