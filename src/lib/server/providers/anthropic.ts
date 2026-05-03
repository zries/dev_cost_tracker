import type { UsageProvider, UsageReport, ValidationResult, UsageBreakdownLine } from './types';

const BASE = 'https://api.anthropic.com';
const VERSION = '2023-06-01';

type CostReportItem = {
	amount: string; // decimal string in cents
	currency: string;
	description: string | null;
	cost_type: string | null;
	model: string | null;
	token_type: string | null;
	workspace_id: string | null;
};

type CostReportBucket = {
	starting_at: string;
	ending_at: string;
	results: CostReportItem[];
};

type CostReportResponse = {
	data: CostReportBucket[];
	has_more: boolean;
	next_page: string | null;
};

function startOfUtcMonth(now = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

function startOfNextUtcMonth(now = new Date()): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

async function fetchAllBuckets(apiKey: string, startingAt: string): Promise<CostReportBucket[]> {
	const buckets: CostReportBucket[] = [];
	let page: string | null = null;
	for (let i = 0; i < 32; i++) {
		const url = new URL(`${BASE}/v1/organizations/cost_report`);
		url.searchParams.set('starting_at', startingAt);
		url.searchParams.set('bucket_width', '1d');
		url.searchParams.append('group_by[]', 'description');
		if (page) url.searchParams.set('page', page);

		const res = await fetch(url, {
			headers: {
				'x-api-key': apiKey,
				'anthropic-version': VERSION
			}
		});

		if (!res.ok) {
			const body = await res.text().catch(() => '');
			throw new Error(`Anthropic ${res.status}: ${body.slice(0, 200) || res.statusText}`);
		}

		const json = (await res.json()) as CostReportResponse;
		buckets.push(...json.data);
		if (!json.has_more || !json.next_page) break;
		page = json.next_page;
	}
	return buckets;
}

function summarize(buckets: CostReportBucket[]): { total: number; perDescription: Map<string, number>; currency: string } {
	let total = 0;
	let currency = 'USD';
	const perDescription = new Map<string, number>();
	for (const b of buckets) {
		for (const r of b.results) {
			// amounts are in cents as decimal strings → divide by 100 for dollars
			const cents = Number(r.amount);
			if (!Number.isFinite(cents)) continue;
			const dollars = cents / 100;
			total += dollars;
			currency = r.currency || currency;
			const label = r.description ?? r.cost_type ?? 'usage';
			perDescription.set(label, (perDescription.get(label) ?? 0) + dollars);
		}
	}
	return { total, perDescription, currency };
}

function project(actual: number, periodStartMs: number, nowMs: number, periodEndMs: number): number {
	const elapsed = Math.max(1, nowMs - periodStartMs);
	const total = Math.max(elapsed, periodEndMs - periodStartMs);
	return actual * (total / elapsed);
}

export const anthropic: UsageProvider = {
	id: 'anthropic_api',
	label: 'Anthropic API',
	keyPlaceholder: 'sk-ant-admin01-…',
	keyHelp:
		'Requires an Admin API key (sk-ant-admin…). Create one at console.anthropic.com → Settings → Admin Keys. Regular API keys cannot read the cost report.',

	async validateKey(apiKey: string): Promise<ValidationResult> {
		// Cheapest call: ask for one bucket starting now. A 401/403 answers the
		// validity question without us having to interpret payloads.
		const url = new URL(`${BASE}/v1/organizations/cost_report`);
		url.searchParams.set('starting_at', new Date().toISOString());
		url.searchParams.set('limit', '1');
		try {
			const res = await fetch(url, {
				headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION }
			});
			if (res.status === 401 || res.status === 403) {
				return { ok: false, error: 'Anthropic rejected the key (unauthorized).' };
			}
			if (!res.ok) {
				const body = await res.text().catch(() => '');
				return { ok: false, error: `Anthropic ${res.status}: ${body.slice(0, 200) || res.statusText}` };
			}
			return { ok: true };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
		}
	},

	async fetchMonthToDate(apiKey: string): Promise<UsageReport> {
		const now = new Date();
		const start = startOfUtcMonth(now);
		const end = startOfNextUtcMonth(now);
		const buckets = await fetchAllBuckets(apiKey, start.toISOString());
		const { total, perDescription, currency } = summarize(buckets);

		const breakdown: UsageBreakdownLine[] = [...perDescription.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 10)
			.map(([label, amount]) => ({ label, amount }));

		return {
			periodStart: Math.floor(start.getTime() / 1000),
			periodEnd: Math.floor(end.getTime() / 1000),
			actualAmount: total,
			projectedAmount: project(total, start.getTime(), now.getTime(), end.getTime()),
			currency,
			breakdown
		};
	}
};
