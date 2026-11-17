/* Local data store.
 * Everything is kept in chrome.storage.local first, so the page works offline.
 * Each record carries updatedAt; deletions are kept as tombstones for a while so
 * that merging with the copy in Google Drive never brings a deleted item back. */
(function () {
	"use strict";
	const KEY = "hamyar_data";
	const TOMBSTONE_TTL = 60 * 24 * 3600 * 1000; // 60 days

	const empty = () => ({ schema: 1, items: {}, settings: { name: "", theme: "dark", updatedAt: 0 } });
	const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

	let data = empty();
	const listeners = new Set();

	function normalize(d) {
		const out = empty();
		if (!d || typeof d !== "object") return out;
		if (d.items && typeof d.items === "object") {
			for (const [id, it] of Object.entries(d.items)) {
				if (it && typeof it === "object" && typeof it.type === "string" && typeof it.updatedAt === "number") out.items[id] = { ...it, id };
			}
		}
		if (d.settings && typeof d.settings === "object") out.settings = { ...out.settings, ...d.settings };
		return out;
	}

	/** Merge two copies: for every record the newest edit wins. */
	function merge(a, b) {
		a = normalize(a);
		b = normalize(b);
		const out = empty();
		const ids = new Set([...Object.keys(a.items), ...Object.keys(b.items)]);
		const now = Date.now();
		for (const id of ids) {
			const x = a.items[id], y = b.items[id];
			const win = !x ? y : !y ? x : y.updatedAt > x.updatedAt ? y : x;
			if (win.deleted && now - win.updatedAt > TOMBSTONE_TTL) continue;
			out.items[id] = win;
		}
		out.settings = (b.settings.updatedAt || 0) > (a.settings.updatedAt || 0) ? b.settings : a.settings;
		return out;
	}

	async function load() {
		const r = await chrome.storage.local.get(KEY);
		data = normalize(r[KEY]);
		return data;
	}

	let saveTimer = null;
	function persist() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => chrome.storage.local.set({ [KEY]: data }), 150);
	}

	function emit(source) {
		persist();
		for (const fn of listeners) fn(data, source);
	}

	const Store = {
		uid,
		merge,
		normalize,
		load,
		get: () => data,
		/** Replace the whole data (after a merge with Drive or an import). */
		replace(next, source = "external") {
			data = normalize(next);
			emit(source);
		},
		list(type) {
			return Object.values(data.items)
				.filter((it) => it.type === type && !it.deleted)
				.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt - b.createdAt);
		},
		add(type, fields) {
			const now = Date.now();
			const id = uid();
			const order = Math.max(0, ...Store.list(type).map((i) => (i.order ?? 0) + 1));
			data.items[id] = { id, type, createdAt: now, updatedAt: now, order, ...fields };
			emit("local");
			return data.items[id];
		},
		update(id, fields) {
			const it = data.items[id];
			if (!it) return;
			data.items[id] = { ...it, ...fields, updatedAt: Date.now() };
			emit("local");
		},
		remove(id) {
			const it = data.items[id];
			if (!it) return;
			data.items[id] = { id, type: it.type, deleted: true, updatedAt: Date.now() };
			emit("local");
		},
		setSetting(k, v) {
			data.settings = { ...data.settings, [k]: v, updatedAt: Date.now() };
			emit("local");
		},
		subscribe(fn) {
			listeners.add(fn);
			return () => listeners.delete(fn);
		},
		/** Flush any pending write (used before the page closes). */
		flush() {
			clearTimeout(saveTimer);
			return chrome.storage.local.set({ [KEY]: data });
		}
	};

	// Another open new-tab page changed the data: pick it up.
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area !== "local" || !changes[KEY]) return;
		const incoming = normalize(changes[KEY].newValue);
		if (JSON.stringify(incoming) === JSON.stringify(data)) return;
		data = merge(data, incoming);
		for (const fn of listeners) fn(data, "other-tab");
	});

	window.Store = Store;
})();
