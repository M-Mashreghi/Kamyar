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
		out.settings = mergeSettings(a.settings, b.settings);
		dropSeedCopies(out);
		return out;
	}

	/* Settings merge key by key, so a change made on one device never wipes out a different change made on
	 * another (for example the first settings of a new install against the copy in Drive). Each key's time is
	 * kept in settings._t; older copies without it count every key at their settings.updatedAt. */
	const keyTime = (st, k) => (st._t && typeof st._t[k] === "number" ? st._t[k] : k in st ? st.updatedAt || 0 : -1);
	function mergeSettings(a, b) {
		const out = { _t: {} };
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		keys.delete("_t");
		keys.delete("updatedAt");
		for (const k of keys) {
			const ta = keyTime(a, k), tb = keyTime(b, k);
			const src = tb > ta ? b : a;
			if (k in src) out[k] = src[k];
			out._t[k] = Math.max(ta, tb, 0);
		}
		out.updatedAt = Math.max(a.updatedAt || 0, b.updatedAt || 0);
		return out;
	}
	// The starter shortcuts of a new install (seed: true) go away when the same site comes from another copy.
	function dropSeedCopies(d) {
		const live = Object.values(d.items).filter((it) => it.type === "bookmark" && !it.deleted);
		for (const it of live) {
			if (!it.seed) continue;
			const same = (o) => o !== it && !d.items[o.id].deleted && (o.url || "").replace(/\/$/, "") === (it.url || "").replace(/\/$/, "");
			// Keep a real shortcut over a starter one; of two starter ones, keep the one with the smaller id.
			if (live.some((o) => same(o) && (!o.seed || o.id < it.id))) d.items[it.id] = { id: it.id, type: "bookmark", deleted: true, updatedAt: it.updatedAt };
		}
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
			const now = Date.now();
			const st = data.settings;
			// First change after an upgrade: give every existing key the time it had so far.
			const times = st._t ? { ...st._t } : Object.fromEntries(Object.keys(st).filter((x) => x !== "updatedAt").map((x) => [x, st.updatedAt || 0]));
			data.settings = { ...st, [k]: v, _t: { ...times, [k]: now }, updatedAt: now };
			emit("local");
		},
		/** When a setting was last changed (0 if never). */
		settingTime: (k) => Math.max(0, keyTime(data.settings, k)),
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
