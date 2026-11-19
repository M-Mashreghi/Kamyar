/* Zero-setup cloud copy through Chrome Sync (chrome.storage.sync).
 * When the person is signed in to Chrome, Chrome stores this data in their own Google account and brings it
 * to their other computers. No Google Cloud project or sign-in button is needed.
 * Chrome allows about 100 KB per extension, so the data is gzip-compressed and split into 8 KB pieces. */
(function () {
	"use strict";
	const META = "hs_meta";
	const PIECE = "hs_";
	const PIECE_CHARS = 7800; // below the 8 KB per-item limit, leaving room for the key and quotes
	const LIMIT = 100 * 1024;

	async function gzip(str) {
		const stream = new Blob([str]).stream().pipeThrough(new CompressionStream("gzip"));
		const buf = new Uint8Array(await new Response(stream).arrayBuffer());
		let bin = "";
		for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
		return btoa(bin);
	}
	async function gunzip(b64) {
		const bin = atob(b64);
		const buf = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
		const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
		return new Response(stream).text();
	}
	async function hash(str) {
		const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
		return Array.from(new Uint8Array(d).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
	}

	let lastHash = null;
	let status = { state: "idle", bytes: 0, email: "" };
	const listeners = new Set();
	const emit = () => listeners.forEach((fn) => fn(status));

	async function read() {
		const all = await chrome.storage.sync.get(null);
		const meta = all[META];
		if (!meta || !meta.n) return null;
		let b64 = "";
		for (let i = 0; i < meta.n; i++) {
			const p = all[PIECE + i];
			if (typeof p !== "string") return null; // another device is still writing
			b64 += p;
		}
		try {
			const json = await gunzip(b64);
			if ((await hash(json)) !== meta.hash) return null;
			lastHash = meta.hash;
			return JSON.parse(json);
		} catch {
			return null;
		}
	}

	async function write(data) {
		const json = JSON.stringify(data);
		const h = await hash(json);
		if (h === lastHash) return;
		const b64 = await gzip(json);
		if (b64.length > LIMIT - 2048) {
			status = { ...status, state: "full", bytes: b64.length };
			emit();
			return;
		}
		const pieces = {};
		const n = Math.ceil(b64.length / PIECE_CHARS);
		for (let i = 0; i < n; i++) pieces[PIECE + i] = b64.slice(i * PIECE_CHARS, (i + 1) * PIECE_CHARS);
		pieces[META] = { n, hash: h, at: Date.now() };
		const old = (await chrome.storage.sync.get(META))[META];
		await chrome.storage.sync.set(pieces);
		if (old && old.n > n) await chrome.storage.sync.remove(Array.from({ length: old.n - n }, (_, i) => PIECE + (n + i)));
		lastHash = h;
		status = { ...status, state: "ok", bytes: b64.length, at: Date.now() };
		emit();
	}

	let timer = null;
	const ChromeSync = {
		get status() {
			return status;
		},
		onStatus(fn) {
			listeners.add(fn);
		},
		/** Read the copy in the Google account and merge it into the local data. */
		async pull() {
			try {
				const info = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" }).catch(() => ({}));
				status = { ...status, email: (info && info.email) || "" };
				const remote = await read();
				if (remote) {
					const before = JSON.stringify(Store.get());
					const merged = Store.merge(Store.get(), remote);
					if (JSON.stringify(merged) !== before) Store.replace(merged, "chromesync");
				}
				status = { ...status, state: status.state === "full" ? "full" : "ok" };
			} catch (e) {
				console.warn("[Rubi] Chrome sync read failed", e);
				status = { ...status, state: "error" };
			}
			emit();
		},
		schedulePush(ms = 3000) {
			clearTimeout(timer);
			timer = setTimeout(() => write(Store.get()).catch((e) => {
				console.warn("[Rubi] Chrome sync write failed", e);
				status = { ...status, state: /QUOTA/i.test(String(e)) ? "full" : "error" };
				emit();
			}), ms);
		},
		flush() {
			clearTimeout(timer);
			return write(Store.get()).catch(() => {});
		}
	};

	// Another computer changed the data.
	chrome.storage.onChanged.addListener((changes, area) => {
		if (area === "sync" && changes[META] && changes[META].newValue && changes[META].newValue.hash !== lastHash) ChromeSync.pull();
	});

	window.ChromeSync = ChromeSync;
})();
