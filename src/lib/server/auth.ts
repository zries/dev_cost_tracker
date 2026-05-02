import { hash, verify } from '@node-rs/argon2';
import { randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import { db } from './db';
import { sessions, users } from './db/schema';
import type { Cookies } from '@sveltejs/kit';

const SESSION_COOKIE = 'devcost_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const argonOpts = {
	memoryCost: 19456,
	timeCost: 2,
	outputLen: 32,
	parallelism: 1
};

export async function hashPassword(password: string): Promise<string> {
	return hash(password, argonOpts);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
	try {
		return await verify(passwordHash, password, argonOpts);
	} catch {
		return false;
	}
}

export function newSessionId(): string {
	return randomBytes(32).toString('hex');
}

export async function createSession(userId: number): Promise<{ id: string; expiresAt: number }> {
	const id = newSessionId();
	const expiresAt = Math.floor((Date.now() + SESSION_TTL_MS) / 1000);
	db.insert(sessions).values({ id, userId, expiresAt }).run();
	return { id, expiresAt };
}

export function deleteSession(id: string): void {
	db.delete(sessions).where(eq(sessions.id, id)).run();
}

export function getSessionUser(id: string):
	| { user: { id: number; username: string }; session: { id: string; expiresAt: number } }
	| null {
	const row = db
		.select({
			sessionId: sessions.id,
			expiresAt: sessions.expiresAt,
			userId: users.id,
			username: users.username
		})
		.from(sessions)
		.innerJoin(users, eq(users.id, sessions.userId))
		.where(eq(sessions.id, id))
		.limit(1)
		.get();

	if (!row) return null;
	if (row.expiresAt * 1000 < Date.now()) {
		deleteSession(id);
		return null;
	}
	return {
		user: { id: row.userId, username: row.username },
		session: { id: row.sessionId, expiresAt: row.expiresAt }
	};
}

export function purgeExpiredSessions(): void {
	db.delete(sessions).where(lt(sessions.expiresAt, Math.floor(Date.now() / 1000))).run();
}

export function setSessionCookie(cookies: Cookies, sessionId: string, expiresAt: number): void {
	cookies.set(SESSION_COOKIE, sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false',
		expires: new Date(expiresAt * 1000)
	});
}

export function clearSessionCookie(cookies: Cookies): void {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function readSessionCookie(cookies: Cookies): string | undefined {
	return cookies.get(SESSION_COOKIE);
}
