import { redirect } from '@sveltejs/kit';
import { clearSessionCookie, deleteSession, readSessionCookie } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const id = readSessionCookie(cookies);
	if (id) deleteSession(id);
	clearSessionCookie(cookies);
	throw redirect(303, '/login');
};
