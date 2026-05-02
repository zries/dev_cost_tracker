import type { SubmitFunction } from '@sveltejs/kit';
import { toast } from './toast.svelte';

type SuccessMsg = string | (() => string) | null;
type ErrorMsg = string | ((err: string) => string) | null;

/**
 * `use:enhance` callback that fires a toast on the result.
 * Pass `null` to suppress one side (e.g. `withToast(null, 'Login failed')`
 * shows nothing on success).
 */
export function withToast(
	successMsg: SuccessMsg,
	errorMsg: ErrorMsg = (err) => err
): SubmitFunction {
	return () => async ({ result, update }) => {
		if (result.type === 'redirect' && successMsg !== null) {
			toast.success(typeof successMsg === 'function' ? successMsg() : successMsg);
		} else if (result.type === 'success' && successMsg !== null) {
			toast.success(typeof successMsg === 'function' ? successMsg() : successMsg);
		} else if (result.type === 'failure' && errorMsg !== null) {
			const fallback = (result.data as { error?: string } | undefined)?.error ?? 'Something went wrong.';
			toast.error(typeof errorMsg === 'function' ? errorMsg(fallback) : errorMsg);
		} else if (result.type === 'error') {
			toast.error('Server error: ' + (result.error?.message ?? 'unknown'));
		}
		await update();
	};
}
