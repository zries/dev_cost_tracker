export type ToastType = 'success' | 'error' | 'info';
export type Toast = {
	id: number;
	message: string;
	type: ToastType;
};

let _items = $state<Toast[]>([]);
let nextId = 0;

export const toastState = {
	get items() {
		return _items;
	}
};

function add(message: string, type: ToastType, ttl: number) {
	const id = ++nextId;
	_items = [..._items, { id, message, type }];
	if (ttl > 0) {
		setTimeout(() => dismiss(id), ttl);
	}
	return id;
}

function dismiss(id: number) {
	_items = _items.filter((t) => t.id !== id);
}

export const toast = {
	success: (message: string, ttl = 3500) => add(message, 'success', ttl),
	error: (message: string, ttl = 6000) => add(message, 'error', ttl),
	info: (message: string, ttl = 4000) => add(message, 'info', ttl),
	dismiss
};
