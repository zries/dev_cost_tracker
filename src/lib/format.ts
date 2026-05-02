export function fmtMoney(amount: number, currency = 'USD'): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		maximumFractionDigits: amount < 100 ? 2 : 0
	}).format(amount);
}

export function fmtMoneyPrecise(amount: number, currency = 'USD'): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(amount);
}

export function fmtPercent(fraction: number): string {
	return new Intl.NumberFormat('en-US', {
		style: 'percent',
		maximumFractionDigits: 1
	}).format(fraction);
}

export function fmtDate(unixSeconds: number | null | undefined): string {
	if (!unixSeconds) return '—';
	return new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}
