/* Rubi site flag (off by default): the toolbar icon shows the flag of the country where the
 * open site's server is, with a small Rubi badge in the corner. The country comes from the
 * server's IP address, looked up in a database bundled with the extension (IP to Country Lite
 * by DB-IP, CC BY 4.0), so no address ever leaves the computer. Flags: flag-icons (MIT).
 * Needs the optional "webRequest" permission and access to all sites; both are asked for when
 * the user turns it on (settings.siteFlag in hamyar_data). */
(() => {
	"use strict";
	const FLAG_PERMS = { permissions: ["webRequest"], origins: ["<all_urls>"] };
	const SKIP_TLD = new Set(["io", "co", "tv", "me", "ai", "ly", "fm", "gg", "to", "cc", "ws", "app", "dev", "xyz", "so", "sh", "is", "ac", "la", "nu", "tk", "ml", "ga", "cf", "gq", "su"]);
	let on = false, geo = null, geoP = null, art = null, artP = null;
	const hosts = new Map(); // host → country code, so pages served from the cache keep their flag

	/* ---------- the database ---------- */
	function loadGeo() {
		return (geoP ||= fetch(chrome.runtime.getURL("data/geo.bin")).then((r) => r.arrayBuffer()).then((buf) => {
			const v = new DataView(buf);
			const nc = v.getUint32(4, true), n4 = v.getUint32(8, true), n6 = v.getUint32(12, true);
			let o = 16;
			const cc = new TextDecoder().decode(new Uint8Array(buf, o, nc * 2)); o += nc * 2;
			const codes = Array.from({ length: nc }, (_, i) => cc.slice(i * 2, i * 2 + 2));
			const v4 = new Uint32Array(buf.slice(o, o + n4 * 4)); o += n4 * 4;
			const c4 = new Uint8Array(buf, o, n4); o += n4;
			const v6 = new Uint32Array(buf.slice(o, o + n6 * 8)); o += n6 * 8;
			const c6 = new Uint8Array(buf, o, n6);
			return (geo = { codes, v4, c4, v6, c6 });
		}));
	}
	// Last range whose start is <= the address.
	function find(len, cmp) {
		let lo = 0, hi = len - 1, r = -1;
		while (lo <= hi) { const m = (lo + hi) >> 1; if (cmp(m) <= 0) { r = m; lo = m + 1; } else hi = m - 1; }
		return r;
	}
	function parse6(ip) {
		ip = ip.replace(/^\[|\]$/g, "").split("%")[0];
		const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
		if (m) return { v4: m[1] };
		let [a, b = ""] = ip.split("::");
		const L = a ? a.split(":") : [], R = b ? b.split(":") : [];
		const parts = ip.includes("::") ? [...L, ...Array(8 - L.length - R.length).fill("0"), ...R] : L;
		const w = parts.map((x) => parseInt(x || "0", 16) >>> 0);
		return { hi: ((w[0] << 16) | w[1]) >>> 0, lo: ((w[2] << 16) | w[3]) >>> 0 };
	}
	function countryOf(ip) {
		if (!geo || !ip) return "";
		let p = ip.includes(":") ? parse6(ip) : { v4: ip };
		let i, c;
		if (p.v4) {
			const n = p.v4.split(".").reduce((a, x) => a * 256 + (+x), 0);
			i = find(geo.v4.length, (m) => (geo.v4[m] < n ? -1 : geo.v4[m] > n ? 1 : 0));
			c = i < 0 ? "--" : geo.codes[geo.c4[i]];
		} else {
			i = find(geo.c6.length, (m) => { const h = geo.v6[m * 2], l = geo.v6[m * 2 + 1]; return h !== p.hi ? (h < p.hi ? -1 : 1) : l < p.lo ? -1 : l > p.lo ? 1 : 0; });
			c = i < 0 ? "--" : geo.codes[geo.c6[i]];
		}
		return c === "--" ? "" : c;
	}
	const tldCountry = (host) => { const t = host.split(".").pop(); return /^[a-z]{2}$/.test(t) && !SKIP_TLD.has(t) ? (t === "uk" ? "GB" : t.toUpperCase()) : ""; };

	/* ---------- the icon ---------- */
	const bitmap = (path) => fetch(chrome.runtime.getURL(path)).then((r) => r.blob()).then((b) => createImageBitmap(b));
	function loadArt() { return (artP ||= Promise.all([bitmap("data/flags.png"), bitmap("icons/icon-128.png")]).then(([flags, logo]) => (art = { flags, logo }))); }
	const icons = new Map(); // country → imageData
	function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
	function drawIcon(cc, sizes) {
		if (!sizes && icons.has(cc)) return icons.get(cc);
		const i = geo.codes.indexOf(cc), out = {};
		for (const S of sizes || [16, 32]) {
			const c = new OffscreenCanvas(S, S), g = c.getContext("2d");
			g.imageSmoothingQuality = "high";
			// The flag fills the icon, with soft corners and a thin edge so white flags still show.
			g.save(); rr(g, 0, 0, S, S, S * 0.22); g.clip();
			g.drawImage(art.flags, (i % 16) * 64, Math.floor(i / 16) * 64, 64, 64, 0, 0, S, S);
			g.restore();
			g.lineWidth = Math.max(1, S / 24); g.strokeStyle = "rgba(0,0,0,.28)"; rr(g, g.lineWidth / 2, g.lineWidth / 2, S - g.lineWidth, S - g.lineWidth, S * 0.22); g.stroke();
			// Rubi's badge: a small round logo in the lower corner, with a white ring.
			const b = S * 0.5, x = S - b, y = S - b;
			g.beginPath(); g.arc(x + b / 2, y + b / 2, b / 2, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill();
			g.save(); g.beginPath(); g.arc(x + b / 2, y + b / 2, b / 2 - Math.max(1, S / 32), 0, Math.PI * 2); g.clip();
			const k = Math.max(1, S / 32);
			g.drawImage(art.logo, x + k, y + k, b - 2 * k, b - 2 * k);
			g.restore();
			out[S] = g.getImageData(0, 0, S, S);
		}
		if (!sizes) icons.set(cc, out);
		return out;
	}
	async function lang() {
		const { hamyar_lang: l, hamyar_data: d } = await chrome.storage.local.get(["hamyar_lang", "hamyar_data"]);
		return (d && d.settings && d.settings.lang) || l || "fa";
	}
	const T = {
		fa: (n) => `روبی · سرور این سایت در ${n} است`, en: (n) => `Rubi · this site's server is in ${n}`,
		fr: (n) => `Rubi · le serveur de ce site est en/au ${n}`, de: (n) => `Rubi · Server dieser Seite: ${n}`
	};
	const DEF_TITLE = chrome.runtime.getManifest().action?.default_title || "Rubi";
	async function show(tabId, cc) {
		if (!on || tabId < 0) return;
		try {
			if (!cc) { await chrome.action.setIcon({ tabId, path: chrome.runtime.getManifest().action.default_icon }); await chrome.action.setTitle({ tabId, title: DEF_TITLE }); return; }
			await Promise.all([loadGeo(), loadArt()]);
			if (geo.codes.indexOf(cc) < 0) return show(tabId, "");
			const l = await lang();
			let name = cc;
			try { name = new Intl.DisplayNames([l], { type: "region" }).of(cc) || cc; } catch {}
			await chrome.action.setIcon({ tabId, imageData: drawIcon(cc) });
			await chrome.action.setTitle({ tabId, title: (T[l] || T.en)(name) });
		} catch {} // the tab may have closed meanwhile
	}
	const hostOf = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname : ""; } catch { return ""; } };

	/* ---------- watching the tabs ---------- */
	async function onResponse(d) {
		await ready;
		if (!on || d.tabId < 0 || d.type !== "main_frame") return;
		const host = hostOf(d.url);
		if (!host) return show(d.tabId, "");
		await loadGeo();
		const cc = (d.ip && countryOf(d.ip)) || hosts.get(host) || tldCountry(host);
		if (cc) hosts.set(host, cc);
		show(d.tabId, cc);
	}
	// A tab that moves to another site (or to a cached page) gets the flag it is known by, or Rubi's own icon.
	async function onTab(tabId, info) {
		await ready;
		if (!on || !info.url) return;
		const host = hostOf(info.url);
		show(tabId, host ? hosts.get(host) || "" : "");
	}
	let hooked = false;
	function hook() {
		if (hooked || !chrome.webRequest) return;
		hooked = true;
		chrome.webRequest.onResponseStarted.addListener(onResponse, { urls: ["<all_urls>"], types: ["main_frame"] });
		chrome.tabs.onUpdated.addListener(onTab);
	}
	async function resetAll() {
		const tabs = await chrome.tabs.query({});
		const path = chrome.runtime.getManifest().action.default_icon;
		await Promise.all(tabs.map((t) => Promise.all([chrome.action.setIcon({ tabId: t.id, path }), chrome.action.setTitle({ tabId: t.id, title: DEF_TITLE })]).catch(() => {})));
	}
	async function apply() {
		const { hamyar_data: d } = await chrome.storage.local.get("hamyar_data");
		const want = !!(d && d.settings && d.settings.siteFlag);
		const has = await chrome.permissions.contains(FLAG_PERMS).catch(() => false);
		const was = on;
		on = want && has;
		if (on) {
			hook();
			if (!was) {
				// Flags for the tabs already open: their server address isn't known yet, so use the
				// web address ending (.ir → Iran) until the page loads again.
				const tabs = await chrome.tabs.query({});
				tabs.forEach((t) => { const h = hostOf(t.url || ""); h && show(t.id, hosts.get(h) || tldCountry(h)); });
			}
		} else if (was) resetAll();
	}
	// Listeners must be added at start-up so that Chrome wakes this worker for them.
	if (chrome.webRequest) hook();
	chrome.permissions.onAdded.addListener(() => apply());
	chrome.permissions.onRemoved.addListener(() => apply());
	chrome.storage.onChanged.addListener((c, area) => area === "local" && c.hamyar_data && apply());
	const ready = apply().catch(() => {});
	self.KamyarFlag = { countryOf: (ip) => loadGeo().then(() => countryOf(ip)), apply, drawIcon: async (cc, sizes) => { await Promise.all([loadGeo(), loadArt()]); return drawIcon(cc, sizes); } };
})();
