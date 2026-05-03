import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

/**
 * Resolve the encryption key from DEVCOST_SECRET_KEY. Accepts either:
 *   - a 64-char hex string (32 bytes), or
 *   - any other string, in which case we SHA-256 it to derive 32 bytes.
 *
 * Returns null when the env var is unset, so the integration UI can degrade
 * gracefully instead of crashing the boot.
 */
function getKey(): Buffer | null {
	const raw = process.env.DEVCOST_SECRET_KEY;
	if (!raw) return null;
	if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
	return createHash('sha256').update(raw, 'utf8').digest();
}

export function isCryptoConfigured(): boolean {
	return getKey() !== null;
}

export type EncryptedSecret = {
	ciphertext: string; // base64
	iv: string; // base64
	authTag: string; // base64
};

export function encryptSecret(plaintext: string): EncryptedSecret {
	const key = getKey();
	if (!key) {
		throw new Error('DEVCOST_SECRET_KEY is not set; cannot store API credentials.');
	}
	const iv = randomBytes(IV_LEN);
	const cipher = createCipheriv(ALGO, key, iv);
	const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return {
		ciphertext: ct.toString('base64'),
		iv: iv.toString('base64'),
		authTag: tag.toString('base64')
	};
}

export function decryptSecret(s: EncryptedSecret): string {
	const key = getKey();
	if (!key) {
		throw new Error('DEVCOST_SECRET_KEY is not set; cannot decrypt API credentials.');
	}
	const decipher = createDecipheriv(ALGO, key, Buffer.from(s.iv, 'base64'));
	decipher.setAuthTag(Buffer.from(s.authTag, 'base64'));
	const pt = Buffer.concat([
		decipher.update(Buffer.from(s.ciphertext, 'base64')),
		decipher.final()
	]);
	return pt.toString('utf8');
}

/** Last 4 chars, for a "•••• xyz9" UI hint. Never store the full key. */
export function keyHint(plaintext: string): string {
	const trimmed = plaintext.trim();
	if (trimmed.length <= 4) return trimmed;
	return trimmed.slice(-4);
}
