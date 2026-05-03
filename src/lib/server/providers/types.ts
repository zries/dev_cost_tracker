/**
 * A usage provider knows how to talk to a vendor's billing/usage API and
 * return month-to-date spend for a given API key. Adding OpenAI later is just
 * another module that satisfies this interface, plus a registry entry.
 */
export type UsageBreakdownLine = {
	label: string;
	amount: number;
};

export type UsageReport = {
	periodStart: number; // unix seconds, UTC
	periodEnd: number; // unix seconds, UTC (inclusive end of "now" bucket)
	actualAmount: number; // currency units (e.g. dollars)
	projectedAmount: number; // straight-line MTD projection for the full month
	currency: string;
	breakdown: UsageBreakdownLine[];
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

export interface UsageProvider {
	id: string;
	label: string;
	keyPlaceholder: string;
	keyHelp: string;
	validateKey(apiKey: string): Promise<ValidationResult>;
	fetchMonthToDate(apiKey: string): Promise<UsageReport>;
}
