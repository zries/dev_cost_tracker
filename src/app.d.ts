// See https://kit.svelte.dev/docs/types#app
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: { id: number; username: string } | null;
			session: { id: string; expiresAt: number } | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	const __BUILD_SHA__: string;
	const __BUILD_TIME__: string;
}

export {};
