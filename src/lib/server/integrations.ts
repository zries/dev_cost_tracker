import { eq } from 'drizzle-orm';
import { db } from './db';
import { costs, costCredentials, costUsageSnapshots } from './db/schema';
import { decryptSecret, encryptSecret, isCryptoConfigured, keyHint } from './crypto';
import { getProvider, listProviders } from './providers';
import type { UsageReport } from './providers';

export type IntegrationStatus = {
	costId: number;
	providerId: string;
	providerLabel: string;
	hasCredentials: boolean;
	keyHint: string | null;
	snapshot: SnapshotView | null;
};

export type SnapshotView = {
	periodStart: number;
	periodEnd: number;
	actualAmount: number;
	projectedAmount: number;
	currency: string;
	breakdown: { label: string; amount: number }[];
	status: 'ok' | 'error';
	message: string | null;
	fetchedAt: number;
};

export { isCryptoConfigured } from './crypto';
export { listProviders, providerOptions } from './providers';

function snapshotView(row: typeof costUsageSnapshots.$inferSelect | undefined): SnapshotView | null {
	if (!row) return null;
	let breakdown: { label: string; amount: number }[] = [];
	if (row.breakdown) {
		try {
			breakdown = JSON.parse(row.breakdown);
		} catch {
			breakdown = [];
		}
	}
	return {
		periodStart: row.periodStart,
		periodEnd: row.periodEnd,
		actualAmount: row.actualAmount,
		projectedAmount: row.projectedAmount,
		currency: row.currency,
		breakdown,
		status: row.status,
		message: row.message,
		fetchedAt: row.fetchedAt
	};
}

export function getIntegrationStatus(costId: number): IntegrationStatus | null {
	const cost = db.select().from(costs).where(eq(costs.id, costId)).get();
	if (!cost || !cost.integration) return null;
	const provider = getProvider(cost.integration);
	if (!provider) return null;

	const cred = db
		.select()
		.from(costCredentials)
		.where(eq(costCredentials.costId, costId))
		.get();
	const snap = db
		.select()
		.from(costUsageSnapshots)
		.where(eq(costUsageSnapshots.costId, costId))
		.get();

	return {
		costId,
		providerId: provider.id,
		providerLabel: provider.label,
		hasCredentials: Boolean(cred),
		keyHint: cred?.hint ?? null,
		snapshot: snapshotView(snap)
	};
}

export type DashboardIntegrationCard = IntegrationStatus & {
	costName: string;
	costVendor: string | null;
	costMonthly: number;
	costCurrency: string;
};

/** Every active integrated cost — used for the dashboard "Live usage" widget. */
export function listDashboardIntegrations(): DashboardIntegrationCard[] {
	const rows = db.select().from(costs).all();
	const out: DashboardIntegrationCard[] = [];
	for (const c of rows) {
		if (!c.integration) continue;
		const status = getIntegrationStatus(c.id);
		if (!status) continue;
		out.push({
			...status,
			costName: c.name,
			costVendor: c.vendor,
			costMonthly: c.monthlyAmount,
			costCurrency: c.currency
		});
	}
	return out.sort((a, b) => (b.snapshot?.actualAmount ?? 0) - (a.snapshot?.actualAmount ?? 0));
}

export function setIntegration(costId: number, providerId: string | null): void {
	if (providerId !== null && !getProvider(providerId)) {
		throw new Error(`Unknown provider: ${providerId}`);
	}
	db.transaction((tx) => {
		tx.update(costs)
			.set({ integration: providerId, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(costs.id, costId))
			.run();
		if (providerId === null) {
			tx.delete(costCredentials).where(eq(costCredentials.costId, costId)).run();
			tx.delete(costUsageSnapshots).where(eq(costUsageSnapshots.costId, costId)).run();
		}
	});
}

export function storeCredential(costId: number, apiKey: string): void {
	if (!isCryptoConfigured()) {
		throw new Error('DEVCOST_SECRET_KEY is not set on the server.');
	}
	const trimmed = apiKey.trim();
	if (!trimmed) throw new Error('API key is empty.');

	const enc = encryptSecret(trimmed);
	const hint = keyHint(trimmed);
	const now = Math.floor(Date.now() / 1000);

	const existing = db
		.select()
		.from(costCredentials)
		.where(eq(costCredentials.costId, costId))
		.get();

	if (existing) {
		db.update(costCredentials)
			.set({
				ciphertext: enc.ciphertext,
				iv: enc.iv,
				authTag: enc.authTag,
				hint,
				updatedAt: now
			})
			.where(eq(costCredentials.costId, costId))
			.run();
	} else {
		db.insert(costCredentials)
			.values({
				costId,
				ciphertext: enc.ciphertext,
				iv: enc.iv,
				authTag: enc.authTag,
				hint
			})
			.run();
	}
}

export function clearCredential(costId: number): void {
	db.delete(costCredentials).where(eq(costCredentials.costId, costId)).run();
	db.delete(costUsageSnapshots).where(eq(costUsageSnapshots.costId, costId)).run();
}

function readApiKey(costId: number): string | null {
	const cred = db
		.select()
		.from(costCredentials)
		.where(eq(costCredentials.costId, costId))
		.get();
	if (!cred) return null;
	return decryptSecret({ ciphertext: cred.ciphertext, iv: cred.iv, authTag: cred.authTag });
}

function writeSnapshot(
	costId: number,
	report: UsageReport | null,
	error: string | null
): void {
	const now = Math.floor(Date.now() / 1000);
	const existing = db
		.select()
		.from(costUsageSnapshots)
		.where(eq(costUsageSnapshots.costId, costId))
		.get();

	const row = report
		? {
				costId,
				periodStart: report.periodStart,
				periodEnd: report.periodEnd,
				actualAmount: report.actualAmount,
				projectedAmount: report.projectedAmount,
				currency: report.currency,
				breakdown: JSON.stringify(report.breakdown),
				status: 'ok' as const,
				message: null,
				fetchedAt: now
			}
		: {
				costId,
				periodStart: existing?.periodStart ?? now,
				periodEnd: existing?.periodEnd ?? now,
				actualAmount: existing?.actualAmount ?? 0,
				projectedAmount: existing?.projectedAmount ?? 0,
				currency: existing?.currency ?? 'USD',
				breakdown: existing?.breakdown ?? null,
				status: 'error' as const,
				message: error,
				fetchedAt: now
			};

	if (existing) {
		db.update(costUsageSnapshots)
			.set(row)
			.where(eq(costUsageSnapshots.costId, costId))
			.run();
	} else {
		db.insert(costUsageSnapshots).values(row).run();
	}
}

export type RefreshResult =
	| { ok: true; report: UsageReport }
	| { ok: false; error: string };

export async function refreshUsage(costId: number): Promise<RefreshResult> {
	const cost = db.select().from(costs).where(eq(costs.id, costId)).get();
	if (!cost || !cost.integration) return { ok: false, error: 'No integration configured.' };
	const provider = getProvider(cost.integration);
	if (!provider) return { ok: false, error: `Unknown provider: ${cost.integration}` };

	let key: string;
	try {
		const k = readApiKey(costId);
		if (!k) return { ok: false, error: 'No API key stored.' };
		key = k;
	} catch (err) {
		return { ok: false, error: err instanceof Error ? err.message : 'Could not decrypt key.' };
	}

	try {
		const report = await provider.fetchMonthToDate(key);
		writeSnapshot(costId, report, null);
		return { ok: true, report };
	} catch (err) {
		const msg = err instanceof Error ? err.message : 'Provider error';
		writeSnapshot(costId, null, msg);
		return { ok: false, error: msg };
	}
}

export async function validateAndStore(
	costId: number,
	providerId: string,
	apiKey: string
): Promise<{ ok: boolean; error?: string }> {
	const provider = getProvider(providerId);
	if (!provider) return { ok: false, error: `Unknown provider: ${providerId}` };
	const v = await provider.validateKey(apiKey);
	if (!v.ok) return { ok: false, error: v.error };

	setIntegration(costId, providerId);
	storeCredential(costId, apiKey);
	return { ok: true };
}
