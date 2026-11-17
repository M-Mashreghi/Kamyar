/* Kamyar: price alerts, text snippets, printable month calendar and "what's this song?". */
(function () {
	"use strict";
	const { $, el, num, setting, toast } = H;
	const hasLocal = () => !!globalThis.chrome?.storage?.local;
	const toLatin = (s) => String(s).replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c)).replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[,٬،\s]/g, "").replace(/٫/g, ".");

	/* ---------- price alerts ---------- */
	const COINS = [["bitcoin", "Bitcoin", "بیت‌کوین"], ["ethereum", "Ethereum", "اتریوم"], ["tether", "Tether", "تتر"], ["binancecoin", "BNB", "بایننس‌کوین"], ["solana", "Solana", "سولانا"], ["ripple", "XRP", "ریپل"], ["dogecoin", "Dogecoin", "دوج‌کوین"], ["the-open-network", "Toncoin", "تون‌کوین"], ["cardano", "Cardano", "کاردانو"], ["tron", "TRON", "ترون"], ["pax-gold", "Gold (oz)", "طلا (اونس)"]];
	const IRAN = [["usd_sell", "rUsd"], ["eur", "rEur"], ["usdt", "rUsdt"], ["18ayar", "rGold18"], ["sekkeh", "rSekke"], ["bahar", "rBahar"]];
	const fa = () => I18n.lang === "fa";
	function assets() {
		const out = COINS.map(([id, en, f]) => ["c:" + id, fa() ? f : en, "crypto"]);
		const stocks = String(setting("stocks", Rates.DEF_STOCKS) ?? "").toUpperCase().split(/[\s,،]+/).filter(Boolean);
		for (const s of stocks) out.push(["s:" + s, s, "stocks"]);
		if (setting("navasanKey", "")) for (const [f, k] of IRAN) out.push(["ir:" + f, t(k) + (fa() ? " (تومان)" : " (IRT)"), "iran"]);
		out.push(["custom", t("alertOtherStock"), "stocks"]);
		return out;
	}
	function fmtPrice(v, asset) {
		if (asset.startsWith("ir:")) return num(Math.round(v)) + " " + t("toman");
		return new Intl.NumberFormat(I18n.locale, { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 4 : 2 }).format(v);
	}
	let fired = {}, last = { prices: {} };
	async function loadAlertState() {
		if (!hasLocal()) return;
		const r = await chrome.storage.local.get(["kamyar_alert_fired", "kamyar_alert_last"]);
		fired = r.kamyar_alert_fired || {};
		last = r.kamyar_alert_last || { prices: {} };
	}
	function fillAlertForm() {
		const cur = $("alertAsset").value || "c:bitcoin";
		const groups = { crypto: t("alertCrypto"), stocks: t("ratesStocks"), iran: t("ratesIran") };
		$("alertAsset").replaceChildren(
			...Object.entries(groups).map(([g, label]) => {
				const opts = assets().filter((a) => a[2] === g);
				return opts.length ? el("optgroup", { label }, ...opts.map(([v, name]) => el("option", { value: v, selected: v === cur }, name))) : "";
			})
		);
		$("alertCustom").hidden = $("alertAsset").value !== "custom";
	}
	function drawAlerts() {
		const list = Store.list("alert").sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
		$("alertList").replaceChildren(
			...(list.length
				? list.map((x) => {
					const p = last.prices && last.prices[x.asset];
					const done = fired[x.id];
					return el("li", { class: "alert-item" + (done ? " fired" : "") },
						el("span", { class: "alert-bell" }, done ? "✅" : "🔔"),
						el("span", { class: "alert-text" },
							el("strong", { dir: "auto" }, x.name),
							el("small", { class: "muted" }, (x.op === "<" ? t("alertBelow") : t("alertAbove")) + " " + fmtPrice(Number(x.value), x.asset) + (p != null ? " · " + t("alertNow", { p: fmtPrice(p, x.asset) }) : ""))),
						done ? el("button", { type: "button", class: "chip", onclick: () => rearm(x.id) }, t("alertRearm")) : "",
						el("button", { type: "button", class: "icon-btn small alert-x", title: t("delete"), onclick: () => Store.remove(x.id) }, "✕"));
				})
				: [el("li", { class: "muted small alert-empty" }, t("alertEmpty"))])
		);
		$("alertLast").textContent = last.at ? t("updatedAt", { time: new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit" }).format(new Date(last.at)) }) : "";
	}
	async function rearm(id) {
		delete fired[id];
		if (hasLocal()) await chrome.storage.local.set({ kamyar_alert_fired: fired });
		drawAlerts();
		checkNow();
	}
	function checkNow() {
		if (hasLocal() && chrome.runtime?.sendMessage) chrome.runtime.sendMessage({ type: "kamyar-alerts-check" }).catch(() => {});
	}
	$("alertAsset").addEventListener("change", () => {
		$("alertCustom").hidden = $("alertAsset").value !== "custom";
		if (!$("alertCustom").hidden) $("alertCustom").focus();
	});
	$("alertForm").addEventListener("submit", (e) => {
		e.preventDefault();
		let asset = $("alertAsset").value, name = $("alertAsset").selectedOptions[0]?.textContent || asset;
		if (asset === "custom") {
			const sym = $("alertCustom").value.trim().toUpperCase();
			if (!/^[\^A-Z0-9.\-=]{1,12}$/.test(sym)) return toast(t("alertBad"));
			asset = "s:" + sym;
			name = sym;
		}
		const value = Number(toLatin($("alertValue").value));
		if (!(value > 0)) return toast(t("alertBad"));
		Store.add("alert", { asset, name, op: $("alertOp").value, value });
		$("alertValue").value = "";
		$("alertCustom").value = "";
		toast(t("alertAdded"));
		setTimeout(checkNow, 300);
	});
	if (hasLocal() && chrome.storage.onChanged)
		chrome.storage.onChanged.addListener((c, area) => {
			if (area === "local" && (c.kamyar_alert_fired || c.kamyar_alert_last)) loadAlertState().then(drawAlerts);
		});

	/* ---------- snippets ---------- */
	let editing = null;
	async function copy(text) {
		try {
			await navigator.clipboard.writeText(text);
			toast(t("copied"));
		} catch {
			toast(t("copyFail"));
		}
	}
	function drawSnippets() {
		const list = Store.list("snippet").sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
		$("snipList").replaceChildren(
			...(list.length
				? list.map((x) =>
					el("div", { class: "snip" },
						el("button", { type: "button", class: "snip-main", title: t("snipCopy"), onclick: () => copy(x.text) },
							el("strong", { dir: "auto" }, x.title || x.text.split("\n")[0].slice(0, 40)),
							el("span", { class: "snip-preview muted", dir: "auto" }, x.text)),
						el("div", { class: "snip-tools" },
							el("button", { type: "button", class: "icon-btn small", title: t("snipCopy"), onclick: () => copy(x.text) }, "📋"),
							el("button", { type: "button", class: "icon-btn small", title: t("edit"), onclick: () => editSnippet(x) }, "✎"),
							el("button", { type: "button", class: "icon-btn small", title: t("delete"), onclick: () => Store.remove(x.id) }, "✕"))))
				: [el("p", { class: "muted small" }, t("snipEmpty"))])
		);
	}
	function editSnippet(x) {
		editing = x ? x.id : null;
		$("snipTitle").value = x ? x.title || "" : "";
		$("snipText").value = x ? x.text : "";
		$("snipCancel").hidden = !x;
		if (x) $("snipText").focus();
	}
	$("snipForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const text = $("snipText").value;
		if (!text.trim()) return;
		const title = $("snipTitle").value.trim().slice(0, 40);
		if (editing) Store.update(editing, { title, text });
		else Store.add("snippet", { title, text });
		editSnippet(null);
	});
	$("snipCancel").addEventListener("click", () => editSnippet(null));

	/* ---------- printable month ---------- */
	function printMonth() {
		const cal = H.calOrder()[0], second = H.calOrder()[1];
		const first = Cal.shown ? Cal.shown() : new Date();
		const month = Cal.parts(cal, first).month;
		const days = [];
		for (let d = new Date(first); Cal.parts(cal, d).month === month; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 12)) days.push(d);
		const ws = Cal.weekStart(), weekend = Cal.weekendDays();
		const title = new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${cal}`, { month: "long", year: "numeric" }).format(first);
		const sub = [days[0], days[days.length - 1]].map((d) => new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${second}`, { month: "long", year: "numeric" }).format(d));
		const wd = new Intl.DateTimeFormat(I18n.locale, { weekday: "long" });
		const dayNum = (c, d) => new Intl.NumberFormat(I18n.locale).format(Cal.parts(c, d).day);
		const events = Store.list("event"), todos = Store.list("todo").filter((x) => x.due && !x.done);
		const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		const cells = [];
		for (let i = 0; i < 7; i++) cells.push(el("div", { class: "pr-wd" + (weekend.includes((ws + i) % 7) ? " off" : "") }, wd.format(new Date(2024, 0, 7 + ((ws + i) % 7)))));
		const lead = (first.getDay() - ws + 7) % 7;
		for (let i = 0; i < lead; i++) cells.push(el("div", { class: "pr-day blank" }));
		for (const d of days) {
			const occ = Cal.occasions(d);
			const off = weekend.includes(d.getDay()) || occ.some((o) => o.off);
			const evs = events.filter((ev) => EvCore.matches(ev, d));
			const tds = todos.filter((x) => x.due === key(d));
			cells.push(el("div", { class: "pr-day" + (off ? " off" : "") },
				el("div", { class: "pr-nums" }, el("b", {}, dayNum(cal, d)), el("small", {}, dayNum(second, d))),
				...occ.slice(0, 3).map((o) => el("div", { class: "pr-occ" + (o.off ? " hol" : "") }, o.emoji + " " + o.name)),
				...evs.slice(0, 3).map((ev) => el("div", { class: "pr-ev" }, (ev.kind === "birthday" ? "🎂 " : "• ") + (ev.start && !ev.allDay ? ev.start + " " : "") + ev.title)),
				...tds.slice(0, 2).map((x) => el("div", { class: "pr-ev" }, "☐ " + x.text))));
		}
		const rows = Math.ceil((lead + days.length) / 7);
		$("printArea").replaceChildren(
			el("div", { class: "pr-sheet", dir: I18n.rtl ? "rtl" : "ltr", style: `--rows:${rows}` },
				el("header", { class: "pr-head" }, el("h1", {}, title), el("span", {}, sub[0] === sub[1] ? sub[0] : sub.join(" – ")), el("span", { class: "pr-brand" }, t("brandFull"))),
				el("div", { class: "pr-grid" }, ...cells),
				el("p", { class: "pr-notes" }, t("printNotes")))
		);
		setTimeout(() => window.print(), 50);
	}
	$("calPrint").addEventListener("click", printMonth);

	/* ---------- what's this song? (AudD) ---------- */
	let recording = null;
	function songView(...kids) {
		$("songBody").replaceChildren(...kids);
		if (!$("songDialog").open) $("songDialog").showModal();
	}
	function needKey() {
		songView(
			el("p", {}, t("songNeedKey")),
			el("ol", { class: "song-steps" }, el("li", {}, t("songStep1"), " ", el("a", { href: "https://dashboard.audd.io/", target: "_blank", rel: "noopener" }, "dashboard.audd.io")), el("li", {}, t("songStep2"))),
			el("form", { class: "song-key", onsubmit: (e) => { e.preventDefault(); const v = e.target.elements.k.value.trim(); if (v) { Store.setSetting("auddKey", v); listen(); } } },
				el("input", { name: "k", dir: "ltr", autocomplete: "off", spellcheck: "false", placeholder: "api_token" }), el("button", { class: "btn", type: "submit" }, t("songSaveListen"))),
			el("p", { class: "muted small" }, t("songPrivacy"))
		);
	}
	async function listen() {
		const key = setting("auddKey", "");
		if (!key) return needKey();
		if (recording) return;
		let stream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
		} catch {
			songView(el("p", {}, t("micNeeded")));
			if (globalThis.chrome?.tabs) chrome.tabs.create({ url: chrome.runtime.getURL("mic.html") });
			return;
		}
		const SECS = 9;
		const chunks = [];
		const rec = new MediaRecorder(stream);
		recording = rec;
		rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
		const count = el("span", { class: "song-count" }, num(SECS));
		songView(el("div", { class: "song-listen" }, el("div", { class: "song-wave" }, ...[...Array(5)].map(() => el("i"))), el("p", {}, t("songListening")), count),
			el("div", { class: "dialog-actions" }, el("span"), el("button", { type: "button", class: "btn btn-ghost", onclick: () => rec.state === "recording" && rec.stop() }, t("songStopNow"))));
		let left = SECS;
		const iv = setInterval(() => { left--; count.textContent = num(Math.max(0, left)); if (left <= 0 && rec.state === "recording") rec.stop(); }, 1000);
		rec.onstop = async () => {
			clearInterval(iv);
			stream.getTracks().forEach((x) => x.stop());
			recording = null;
			if (!$("songDialog").open) return;
			songView(el("div", { class: "song-listen" }, el("p", {}, t("songSearching"))));
			try {
				const fd = new FormData();
				fd.append("api_token", key);
				fd.append("file", new Blob(chunks, { type: rec.mimeType || "audio/webm" }), "clip.webm");
				fd.append("return", "apple_music,spotify");
				const r = await fetch("https://api.audd.io/", { method: "POST", body: fd });
				const d = await r.json();
				if (d.status === "error") {
					const code = d.error && d.error.error_code;
					return songView(el("p", { class: "error" }, code === 900 || code === 901 ? t("songBadKey") : t("songError") + (d.error && d.error.error_message ? " (" + d.error.error_message + ")" : "")), el("button", { type: "button", class: "btn", onclick: needKey }, t("songChangeKey")));
				}
				if (!d.result) return songView(el("p", {}, t("songNotFound")), el("div", { class: "dialog-actions" }, el("span"), el("button", { type: "button", class: "btn", onclick: listen }, t("songAgain"))));
				showSong(d.result);
			} catch {
				songView(el("p", { class: "error" }, t("songError")), el("div", { class: "dialog-actions" }, el("span"), el("button", { type: "button", class: "btn", onclick: listen }, t("songAgain"))));
			}
		};
		rec.start();
	}
	function showSong(s) {
		const q = encodeURIComponent(`${s.artist} ${s.title}`);
		const spotify = s.spotify && s.spotify.external_urls && s.spotify.external_urls.spotify;
		const apple = s.apple_music && s.apple_music.url;
		const cover = (s.spotify && s.spotify.album && s.spotify.album.images && s.spotify.album.images[1] && s.spotify.album.images[1].url) || (s.apple_music && s.apple_music.artwork && s.apple_music.artwork.url && s.apple_music.artwork.url.replace("{w}", "300").replace("{h}", "300")) || "";
		const link = (href, label, cls) => el("a", { class: "song-link " + cls, href, target: "_blank", rel: "noopener" }, label);
		songView(
			el("div", { class: "song-card" },
				cover ? el("img", { class: "song-cover", src: cover, alt: "", width: 120, height: 120 }) : el("div", { class: "song-cover none" }, "🎵"),
				el("div", { class: "song-info" },
					el("strong", { class: "song-title", dir: "auto" }, s.title),
					el("span", { dir: "auto" }, s.artist),
					el("small", { class: "muted", dir: "auto" }, [s.album, s.release_date && s.release_date.slice(0, 4)].filter(Boolean).join(" · ")))),
			el("div", { class: "song-links" },
				link(spotify || "https://open.spotify.com/search/" + q, "Spotify", "sp"),
				link("https://www.youtube.com/results?search_query=" + q, "YouTube", "yt"),
				apple ? link(apple, "Apple Music", "am") : "",
				link("https://www.google.com/search?q=" + encodeURIComponent(`${s.artist} ${s.title} lyrics`), t("songLyrics"), "ly")),
			el("div", { class: "dialog-actions" }, el("span"), el("button", { type: "button", class: "btn btn-ghost", onclick: listen }, t("songAgain")))
		);
		try {
			const hist = JSON.parse(localStorage.getItem("kamyar_songs") || "[]").filter((x) => x.title !== s.title);
			hist.unshift({ title: s.title, artist: s.artist, at: Date.now() });
			localStorage.setItem("kamyar_songs", JSON.stringify(hist.slice(0, 20)));
		} catch {}
	}
	$("songBtn").addEventListener("click", listen);
	$("songDialog").addEventListener("close", () => recording && recording.state === "recording" && recording.stop());
	$("auddInput").addEventListener("change", (e) => Store.setSetting("auddKey", e.target.value.trim()));
	$("settingsBtn").addEventListener("click", () => ($("auddInput").value = setting("auddKey", "")));

	H.onRefresh(() => {
		fillAlertForm();
		drawAlerts();
		drawSnippets();
	});
	(window.hamyarReady || Promise.resolve()).then(async () => {
		await loadAlertState();
		fillAlertForm();
		drawAlerts();
		drawSnippets();
	});
	H.showSong = showSong;
})();
