/* Kamyar: answers in the search bar. Type a sum ("12*(3+4)") or a conversion
 * ("120 دلار به تومان", "5 ft to cm", "30 c in f", "2 GB به مگابایت") and the answer shows under the box. */
(function () {
	"use strict";
	const { $, num, toast } = H;

	const latin = (s) => String(s)
		.replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c)).replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c))
		.replace(/٫/g, ".").replace(/٪/g, "%").replace(/(\d)[٬,](?=\d{3}\b)/g, "$1").replace(/[×✕]/g, "*").replace(/[÷]/g, "/").replace(/(\d)\s*x\s*(\d)/gi, "$1*$2")
		.replace(/‌/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

	/* ---------- a small, safe arithmetic parser (no eval) ---------- */
	function calc(src) {
		let i = 0;
		const s = src.replace(/\s+/g, "");
		const peek = () => s[i];
		function num_() {
			const m = /^\d*\.?\d+(e[+-]?\d+)?/i.exec(s.slice(i));
			if (!m) throw 0;
			i += m[0].length;
			return parseFloat(m[0]);
		}
		function atom() {
			if (peek() === "(") { i++; const v = expr(); if (s[i++] !== ")") throw 0; return v; }
			if (peek() === "-") { i++; return -atom(); }
			if (peek() === "+") { i++; return atom(); }
			if (s.startsWith("sqrt", i)) { i += 4; return Math.sqrt(atom()); }
			if (s.startsWith("pi", i)) { i += 2; return Math.PI; }
			let v = num_();
			if (peek() === "%") { i++; v /= 100; }
			return v;
		}
		function pow() {
			const b = atom();
			if (peek() === "^") { i++; return Math.pow(b, pow()); }
			return b;
		}
		function term() {
			let v = pow();
			while (peek() === "*" || peek() === "/") v = s[i++] === "*" ? v * pow() : v / pow();
			return v;
		}
		function expr() {
			let v = term();
			while (peek() === "+" || peek() === "-") v = s[i++] === "+" ? v + term() : v - term();
			return v;
		}
		const v = expr();
		if (i !== s.length || !isFinite(v)) throw 0;
		return v;
	}

	/* ---------- units ---------- */
	// [kind, factor to the base unit, labels fa|en, aliases...]
	const U = {};
	const ALIAS = new Map();
	function norm(a) { return String(a).replace(/\u200c/g, " ").replace(/\s+/g, " ").trim().toLowerCase(); }
	function unit(id, kind, factor, fa, en, ...aliases) {
		U[id] = { id, kind, factor, fa, en };
		for (const a of [id, fa, en, ...aliases]) ALIAS.set(norm(a), id);
	}
	unit("mm", "len", 0.001, "میلی‌متر", "mm", "میلیمتر", "millimeter", "millimetre", "millimètre", "millimeter");
	unit("cm", "len", 0.01, "سانتی‌متر", "cm", "سانتیمتر", "سانت", "centimeter", "centimetre", "centimètre", "zentimeter");
	unit("m", "len", 1, "متر", "m", "meter", "metre", "meters", "mètre", "mètres");
	unit("km", "len", 1000, "کیلومتر", "km", "kilometer", "kilometre", "kilomètre", "kilometers");
	unit("in", "len", 0.0254, "اینچ", "in", "inch", "inches", "zoll", "pouce", "pouces", "\"");
	unit("ft", "len", 0.3048, "فوت", "ft", "foot", "feet", "fuß", "fuss", "pied", "pieds", "'");
	unit("yd", "len", 0.9144, "یارد", "yd", "yard", "yards");
	unit("mi", "len", 1609.344, "مایل", "mi", "mile", "miles", "meile", "meilen");
	unit("nmi", "len", 1852, "مایل دریایی", "nmi", "nautical mile");
	unit("mg", "mass", 1e-6, "میلی‌گرم", "mg", "میلیگرم", "milligram");
	unit("g", "mass", 0.001, "گرم", "g", "gram", "grams", "gramm", "gramme", "grammes");
	unit("kg", "mass", 1, "کیلوگرم", "kg", "کیلو", "kilo", "kilos", "kilogram", "kilogramm", "kilogramme");
	unit("t", "mass", 1000, "تن", "t", "ton", "tons", "tonne", "tonnes");
	unit("oz", "mass", 0.028349523125, "اونس", "oz", "ounce", "ounces", "unze", "once");
	unit("lb", "mass", 0.45359237, "پوند (وزن)", "lb", "lbs", "pound", "pounds", "pfund", "livre", "livres");
	unit("mithqal", "mass", 0.004608, "مثقال", "mithqal", "mesghal");
	unit("ml", "vol", 0.001, "میلی‌لیتر", "ml", "میلیلیتر", "milliliter", "millilitre");
	unit("l", "vol", 1, "لیتر", "l", "liter", "litre", "liters", "litres");
	unit("gal", "vol", 3.785411784, "گالن", "gal", "gallon", "gallons");
	unit("cup", "vol", 0.2365882365, "پیمانه", "cup", "cups", "tasse");
	unit("m2", "area", 1, "متر مربع", "m²", "متر مربع", "sqm", "square meter", "m^2");
	unit("km2", "area", 1e6, "کیلومتر مربع", "km²", "km^2", "square kilometer");
	unit("ha", "area", 1e4, "هکتار", "ha", "hectare", "hectares", "hektar");
	unit("ft2", "area", 0.09290304, "فوت مربع", "ft²", "sqft", "square feet", "ft^2");
	unit("acre", "area", 4046.8564224, "ایکر", "acre", "acres");
	unit("kmh", "speed", 1 / 3.6, "کیلومتر بر ساعت", "km/h", "kmh", "kph", "kmph");
	unit("mph", "speed", 0.44704, "مایل بر ساعت", "mph");
	unit("ms", "speed", 1, "متر بر ثانیه", "m/s", "mps");
	unit("knot", "speed", 0.514444, "گره", "knots", "knot", "kn");
	unit("b", "data", 1, "بایت", "B", "byte", "bytes", "octet", "octets");
	unit("kb", "data", 1024, "کیلوبایت", "KB", "kilobyte", "kilobytes", "ko");
	unit("mb", "data", 1024 ** 2, "مگابایت", "MB", "megabyte", "megabytes", "mo", "مگ");
	unit("gb", "data", 1024 ** 3, "گیگابایت", "GB", "gigabyte", "gigabytes", "go", "گیگ");
	unit("tb", "data", 1024 ** 4, "ترابایت", "TB", "terabyte", "terabytes", "to", "ترا");
	unit("sec", "time", 1, "ثانیه", "s", "sec", "secs", "second", "seconds", "sekunde", "sekunden", "seconde", "secondes");
	unit("min", "time", 60, "دقیقه", "min", "mins", "minute", "minutes", "minuten");
	unit("h", "time", 3600, "ساعت", "h", "hr", "hrs", "hour", "hours", "stunde", "stunden", "heure", "heures");
	unit("day", "time", 86400, "روز", "days", "day", "tag", "tage", "jour", "jours");
	unit("week", "time", 604800, "هفته", "weeks", "week", "woche", "wochen", "semaine", "semaines");
	unit("c", "temp", 0, "درجه‌ی سانتی‌گراد", "°C", "سانتی‌گراد", "سانتیگراد", "سلسیوس", "celsius", "°c", "degc");
	unit("f", "temp", 0, "فارنهایت", "°F", "°f", "fahrenheit", "degf");
	unit("k", "temp", 0, "کلوین", "K", "kelvin");
	const toC = { c: (v) => v, f: (v) => ((v - 32) * 5) / 9, k: (v) => v - 273.15 };
	const fromC = { c: (v) => v, f: (v) => (v * 9) / 5 + 32, k: (v) => v + 273.15 };

	/* ---------- currencies (from the rates panel's cache) ---------- */
	const CUR = {
		usd: ["دلار", "USD", "$", "dollar", "dollars", "دلار آمریکا", "us dollar"],
		eur: ["یورو", "EUR", "€", "euro", "euros"],
		gbp: ["پوند", "GBP", "£", "pound sterling", "پوند انگلیس", "sterling"],
		chf: ["فرانک", "CHF", "franc", "francs", "فرانک سوئیس", "franken"],
		cad: ["دلار کانادا", "CAD", "canadian dollar"],
		try: ["لیر", "TRY", "lira", "لیر ترکیه", "türkische lira"],
		aed: ["درهم", "AED", "dirham", "dirhams"],
		irt: ["تومان", "IRT", "toman", "tomans"],
		irr: ["ریال", "IRR", "rial", "rials"],
		btc: ["بیت‌کوین", "BTC", "بیتکوین", "bitcoin"],
		eth: ["اتریوم", "ETH", "ethereum"],
		usdt: ["تتر", "USDT", "tether"]
	};
	const CALIAS = new Map();
	for (const [id, names] of Object.entries(CUR)) for (const n of [id, ...names]) CALIAS.set(norm(n), id);
	let rates = null;
	async function loadRates() {
		try {
			rates = (await chrome.storage.local.get("hamyar_rates_cache")).hamyar_rates_cache || null;
		} catch {}
	}
	// Value of one unit of `id` in the cache's base currency, or null.
	function inBase(id) {
		if (!rates) return null;
		const base = String(rates.base || "USD").toLowerCase();
		if (id === base) return 1;
		const up = id.toUpperCase();
		if (rates.fiat && rates.fiat[up]) return 1 / rates.fiat[up];
		const coin = { btc: "bitcoin", eth: "ethereum" }[id];
		if (coin && rates.coins && rates.coins[coin]) return rates.coins[coin].price;
		const usd = base === "usd" ? 1 : rates.fiat && rates.fiat.USD ? 1 / rates.fiat.USD : null;
		const ir = (k) => rates.iran && (rates.iran.find((r) => r.label === k) || {}).value;
		if (id === "usdt") return ir("rUsdt") && ir("rUsd") && usd ? (ir("rUsdt") / ir("rUsd")) * usd : usd;
		if (id === "irt" || id === "irr") {
			const t = ir("rUsd");
			if (!t || !usd) return null;
			return (usd / t) / (id === "irr" ? 10 : 1);
		}
		return null;
	}

	const fa = () => I18n.lang === "fa";
	const fmt = (v) => num(v, { maximumFractionDigits: Math.abs(v) >= 100 ? 2 : Math.abs(v) >= 1 ? 4 : 8 });
	const lookUnit = (w) => U[ALIAS.get(w)] || null;
	const lookCur = (w) => CALIAS.get(w) || null;
	const label = (id) => (U[id] ? (fa() ? U[id].fa : U[id].en) : fa() ? CUR[id][0] : CUR[id][1]);

	// "120 دلار به تومان", "5 ft to cm", "1,5 kg in lb", "30°c en f"
	const CONVERT = /^(.+?)\s*([^\d\s()+*/^.%-][^]*?)\s+(?:به|بر حسب|to|in|into|en|nach|in|=|->|→)\s+(.+?)\??$/;
	function answer(raw) {
		const q = latin(raw);
		if (!q || q.length > 80) return null;
		// Plain arithmetic: needs at least one operator between numbers.
		if (/^[\d\s.+\-*/()%^]+$|sqrt|pi/.test(q) && /\d\s*[-+*/^%]\s*[\d(]|sqrt|\d%/.test(q)) {
			try {
				const v = calc(q);
				return { text: fmt(v), copy: String(+v.toFixed(10)), hint: q.replace(/\*/g, "×").replace(/\//g, "÷") + " =" };
			} catch { return null; }
		}
		let m = CONVERT.exec(q.replace(/°\s*/g, "°").replace(/(\d)(°?[a-z؀-ۿ$€£])/g, "$1 $2"));
		let amountSrc, from, to;
		if (m) [, amountSrc, from, to] = m;
		else {
			// "120 dollars" alone: show it in toman (Persian) or the other main currency.
			const m2 = /^([\d.+\-*/() ]+)\s+(.+)$/.exec(q.replace(/(\d)([a-z؀-ۿ$€£])/g, "$1 $2"));
			if (!m2 || !lookCur(m2[2].trim())) return null;
			[, amountSrc, from] = m2;
			to = lookCur(m2[2].trim()) === "irt" ? "usd" : fa() ? "irt" : lookCur(m2[2].trim()) === "usd" ? "eur" : "usd";
		}
		let amount;
		try { amount = calc(amountSrc.trim()); } catch { return null; }
		from = from.trim(); to = to.trim();
		const uf = lookUnit(from), ut = lookUnit(to);
		if (uf && ut && uf.kind === ut.kind) {
			const v = uf.kind === "temp" ? fromC[ut.id](toC[uf.id](amount)) : (amount * uf.factor) / ut.factor;
			return { text: fmt(v) + " " + label(ut.id), copy: String(+v.toFixed(8)), hint: fmt(amount) + " " + label(uf.id) + " =" };
		}
		// "pound" can be weight or money: weight only when the other side is a weight.
		const cf = lookCur(from) || (from === "pound" || from === "pounds" ? "gbp" : null), ct = lookCur(to) || (to === "pound" || to === "pounds" ? "gbp" : null);
		if (cf && ct) {
			const a = inBase(cf), b = inBase(ct);
			if (a == null || b == null) return { text: t(cf === "irt" || ct === "irt" || cf === "irr" || ct === "irr" ? "calcNeedNavasan" : "calcNoRate"), hint: "", copy: "" };
			const v = (amount * a) / b;
			const nice = ct === "irt" || ct === "irr" ? num(Math.round(v)) : fmt(v);
			return { text: nice + " " + label(ct), copy: String(ct === "irt" || ct === "irr" ? Math.round(v) : +v.toFixed(6)), hint: fmt(amount) + " " + label(cf) + " =", note: t("calcRateNote") };
		}
		return null;
	}

	let cur = null;
	function show() {
		const v = $("searchInput").value;
		cur = v.trim().length >= 2 ? answer(v) : null;
		const box = $("calcAnswer");
		if (!cur) {
			box.hidden = true;
			return;
		}
		box.replaceChildren(
			cur.hint ? Object.assign(document.createElement("small"), { className: "muted", textContent: cur.hint }) : "",
			Object.assign(document.createElement("strong"), { textContent: cur.text }),
			cur.copy ? Object.assign(document.createElement("small"), { className: "muted calc-copy", textContent: "📋 " + t("snipCopy") }) : ""
		);
		box.title = cur.note || "";
		box.hidden = false;
	}
	$("searchInput").addEventListener("input", show);
	$("searchInput").addEventListener("focus", show);
	$("calcAnswer").addEventListener("mousedown", (e) => e.preventDefault());
	$("calcAnswer").addEventListener("click", async () => {
		if (!cur || !cur.copy) return;
		try {
			await navigator.clipboard.writeText(cur.copy);
			toast(t("copied"));
		} catch {}
	});
	$("searchForm").addEventListener("submit", () => ($("calcAnswer").hidden = true));
	window.addEventListener("hamyar-rates", loadRates);
	loadRates();
	H.calcAnswer = answer;
})();
