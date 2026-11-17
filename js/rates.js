/* Currency, gold and crypto rates. Free public sources, no account and no tracking:
 *  - Currencies: Frankfurter (European Central Bank reference rates), fallback open.er-api.com
 *  - Gold (PAX Gold ≈ 1 troy ounce) and crypto: CoinGecko
 *  - Optional: Iranian open-market rates in Toman from Navasan, with the person's own free API key. */
(function () {
	"use strict";
	const { $, el, num, setting } = H;
	const CACHE = "hamyar_rates_cache";
	const TTL = 30 * 60 * 1000;
	const FIAT = ["USD", "EUR", "GBP", "CHF", "CAD", "TRY"];
	const FIAT_KEY = { USD: "rUsd", EUR: "rEur", GBP: "rGbp", CHF: "rChf", CAD: "rCad", TRY: "rTry" };
	const COINS = [["pax-gold", "rGold"], ["bitcoin", "rBtc"], ["ethereum", "rEth"]];
	// Navasan field → label. Fields missing from the answer are skipped.
	const NAVASAN = [["usd_sell", "rUsd"], ["eur", "rEur"], ["gbp", "rGbp"], ["aed", "rAed"], ["try", "rTry"], ["18ayar", "rGold18"], ["sekkeh", "rSekke"], ["bahar", "rBahar"], ["nim", "rNim"], ["rob", "rRob"], ["usdt", "rUsdt"]];

	async function getJson(url) {
		const r = await fetch(url);
		if (!r.ok) throw new Error("HTTP " + r.status);
		return r.json();
	}
	async function fiat(base) {
		const others = FIAT.filter((c) => c !== base);
		try {
			const d = await getJson(`https://api.frankfurter.app/latest?from=${base}&to=${others.join(",")}`);
			return d.rates;
		} catch {
			const d = await getJson(`https://open.er-api.com/v6/latest/${base}`);
			return Object.fromEntries(others.map((c) => [c, d.rates[c]]));
		}
	}
	async function coins(base) {
		const vs = base.toLowerCase();
		const d = await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${COINS.map((c) => c[0]).join(",")}&vs_currencies=${vs}&include_24hr_change=true`);
		return Object.fromEntries(COINS.map(([id]) => [id, d[id] ? { price: d[id][vs], change: d[id][vs + "_24h_change"] } : null]));
	}
	async function navasan(key) {
		const d = await getJson(`https://api.navasan.tech/latest/?api_key=${encodeURIComponent(key)}`);
		const out = [];
		for (const [k, label] of NAVASAN) {
			const v = d[k];
			if (!v || v.value == null) continue;
			out.push({ label, value: Number(String(v.value).replace(/,/g, "")), change: v.change != null ? Number(v.change) : null });
		}
		return out;
	}

	async function load(force) {
		const base = setting("base", "USD"), key = setting("navasanKey", "");
		const sig = base + "|" + (key ? "k" : "");
		const cached = (await chrome.storage.local.get(CACHE))[CACHE];
		if (!force && cached && cached.sig === sig && Date.now() - cached.at < TTL) return cached;
		const [f, c, n] = await Promise.allSettled([fiat(base), coins(base), key ? navasan(key) : Promise.resolve(null)]);
		if (f.status === "rejected" && c.status === "rejected" && (!key || n.status === "rejected")) {
			if (cached && cached.sig === sig) return { ...cached, stale: true };
			throw new Error("rates");
		}
		const prev = cached && cached.sig === sig ? cached : {};
		const out = {
			sig,
			at: Date.now(),
			base,
			fiat: f.status === "fulfilled" ? f.value : prev.fiat || null,
			coins: c.status === "fulfilled" ? c.value : prev.coins || null,
			iran: key ? (n.status === "fulfilled" ? n.value : prev.iran || null) : null,
			iranFailed: !!key && n.status === "rejected"
		};
		await chrome.storage.local.set({ [CACHE]: out });
		return out;
	}

	function money(v, cur) {
		const digits = v >= 1000 ? 0 : v >= 10 ? 2 : 4;
		try {
			return new Intl.NumberFormat(I18n.locale, { style: "currency", currency: cur, maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
		} catch {
			return num(v, { maximumFractionDigits: digits });
		}
	}
	function changeEl(ch) {
		if (ch == null || !isFinite(ch)) return el("span");
		const up = ch >= 0;
		return el("span", { class: "chg " + (up ? "up" : "down") }, (up ? "▲ " : "▼ ") + num(Math.abs(ch), { maximumFractionDigits: 2 }) + "%");
	}

	let data = null;
	function draw() {
		const d = data;
		const rows = [];
		if (d.iran && d.iran.length) {
			rows.push(el("li", { class: "rate-head" }, t("ratesIran")));
			for (const r of d.iran) rows.push(el("li", {}, el("span", {}, t(r.label)), el("strong", {}, `${num(r.value)} ${t("toman")}`), r.change ? el("span", { class: "chg " + (r.change >= 0 ? "up" : "down") }, (r.change >= 0 ? "▲ " : "▼ ") + num(Math.abs(r.change))) : el("span")));
		}
		rows.push(el("li", { class: "rate-head" }, t("ratesIntl")));
		if (d.coins)
			for (const [id, label] of COINS) {
				const c = d.coins[id];
				if (c && c.price != null) rows.push(el("li", {}, el("span", {}, t(label)), el("strong", {}, money(c.price, d.base)), changeEl(c.change)));
			}
		if (d.fiat)
			for (const cur of FIAT) {
				if (cur === d.base || !d.fiat[cur]) continue;
				rows.push(el("li", {}, el("span", {}, `${t(FIAT_KEY[cur])} (${cur})`), el("strong", {}, money(1 / d.fiat[cur], d.base)), el("span")));
			}
		const extra = [];
		if (d.iranFailed) extra.push(el("p", { class: "error small" }, t("ratesFail") + " (Navasan)"));
		if (d.stale) extra.push(el("p", { class: "muted small" }, t("offlineCached")));
		$("ratesBody").replaceChildren(el("ul", { class: "rate-list" }, ...rows), ...extra);
		// Short list for the home ticker: Iranian rates first when available, then gold, crypto and currencies.
		const tick = [];
		if (d.iran) for (const r of d.iran) tick.push({ label: t(r.label), value: `${num(r.value)}`, unit: t("toman"), change: r.change ? (r.change >= 0 ? 1 : -1) : 0 });
		if (d.coins) for (const [id, label] of COINS) { const c = d.coins[id]; if (c && c.price != null) tick.push({ label: t(label), value: money(c.price, d.base), change: c.change || 0, pct: c.change }); }
		if (d.fiat) for (const cur of FIAT) if (cur !== d.base && d.fiat[cur]) tick.push({ label: `${t(FIAT_KEY[cur])}`, code: cur, value: money(1 / d.fiat[cur], d.base), change: 0 });
		H.ticker = tick;
		window.dispatchEvent(new Event("hamyar-rates"));
		$("ratesUpdated").textContent = t("updatedAt", { time: new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(d.at)) });
	}

	async function render(force = false) {
		if (!H.widgetOn("rates")) return;
		if (!data || force) {
			if (!data) $("ratesBody").replaceChildren(el("p", { class: "muted" }, t("loading")));
			try {
				data = await load(force);
			} catch {
				$("ratesBody").replaceChildren(el("p", { class: "error" }, t("ratesFail")));
				return;
			}
		}
		draw();
	}

	let sig = "";
	H.onRefresh(() => {
		const s = JSON.stringify([I18n.lang, setting("base", "USD"), setting("navasanKey", ""), H.widgetOn("rates")]);
		if (s === sig) return;
		const dataChanged = sig && JSON.parse(sig).slice(1, 3).join() !== JSON.parse(s).slice(1, 3).join();
		sig = s;
		render(!!dataChanged);
	});
	$("ratesUpdated").addEventListener("click", () => render(true));
	setInterval(() => document.visibilityState === "visible" && render(true), TTL);
})();
