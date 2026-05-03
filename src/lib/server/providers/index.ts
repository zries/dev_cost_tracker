import { anthropic } from './anthropic';
import type { UsageProvider } from './types';

export type { UsageProvider, UsageReport, ValidationResult, UsageBreakdownLine } from './types';

const REGISTRY: Record<string, UsageProvider> = {
	[anthropic.id]: anthropic
};

export function getProvider(id: string | null | undefined): UsageProvider | null {
	if (!id) return null;
	return REGISTRY[id] ?? null;
}

export function listProviders(): UsageProvider[] {
	return Object.values(REGISTRY);
}

/** Provider option metadata for the UI — kept here so the form doesn't import server-only fetch code. */
export type ProviderOption = {
	id: string;
	label: string;
	keyPlaceholder: string;
	keyHelp: string;
};

export function providerOptions(): ProviderOption[] {
	return listProviders().map((p) => ({
		id: p.id,
		label: p.label,
		keyPlaceholder: p.keyPlaceholder,
		keyHelp: p.keyHelp
	}));
}
