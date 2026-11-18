/* Kamyar v2.12: seasonal looks, quick translator, football scores, family calendar sharing and their settings. */
(function () {
	"use strict";
	const { $, el, num, setting, toast } = H;
	const hasLocal = () => !!globalThis.chrome?.storage?.local;
	const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch {} return null; };

	/* ---------- seasonal and occasion looks ---------- */
	const parts = (cal, d) => Object.fromEntries(new Intl.DateTimeFormat("en-u-ca-" + cal + "-nu-latn", { month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, Number(x.value)]));
	function season(d = new Date()) {
		const p = parts("persian", d), h = parts("islamic-umalqura", d);
		const m = d.getMonth() + 1, day = d.getDate();
		if (h.month === 1 && h.day <= 12) return { id: "muharram", chip: h.day === 9 ? "seTasua" : h.day === 10 ? "seAshura" : "seMuharram", icon: "🏴", fx: [] };
		if ((p.month === 12 && p.day >= 25) || (p.month === 1 && p.day <= 13)) return { id: "nowruz", chip: p.month === 12 ? "seNowruzSoon" : p.day === 13 ? "seSizdah" : "seNowruz", icon: "🌱", fx: ["🌸", "🌱", "🐟", "🥚", "🌷"] };
		if (p.month === 9 && p.day === 30) return { id: "yalda", chip: "seYalda", icon: "🍉", fx: ["🍉", "🍎", "🕯️", "📜", "🌰"] };
		if (p.month === 12 && d.getDay() === 2 && p.day >= 20) return { id: "suri", chip: "seSuri", icon: "🔥", fx: ["🔥", "✨"] };
		if (m === 12 && day >= 20 && day <= 26) return { id: "xmas", chip: "seXmas", icon: "🎄", fx: ["❄️", "❄️", "❅", "⛄"] };
		if ((m === 12 && day === 31) || (m === 1 && day === 1)) return { id: "newyear", chip: "seNewYear", icon: "🎆", fx: ["🎉", "✨", "🎆"] };
		return null;
	}
	let seasonSig = "";
	function drawSeason() {
		const on = setting("seasonal", true) !== false;
		const s = on ? season() : null;
		const sig = JSON.stringify([s && s.id, s && s.chip, I18n.lang]);
		const root = document.documentElement;
		["muharram", "nowruz", "yalda", "suri", "xmas", "newyear"].forEach((id) => root.classList.toggle("season-" + id, !!s && s.id === id));
		$("seasonChip").hidden = !s;
		if (s) $("seasonChip").replaceChildren(el("span", {}, s.icon), " ", t(s.chip));
		if (sig === seasonSig) return;
		seasonSig = sig;
		const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
		$("seasonLayer").replaceChildren(...(!s || reduce ? [] : [...Array(16)].map((_, i) => el("span", { style: `--x:${(i * 6.3 + (i % 3) * 7) % 100}%;--d:${9 + (i % 5) * 2.2}s;--delay:-${(i * 1.7) % 12}s;--s:${0.8 + (i % 4) * 0.25}` }, s.fx[i % s.fx.length]))));
	}
	H.season = season;

	/* ---------- quick translator ---------- */
	const TR_LANGS = ["fa", "en", "de", "fr", "ar", "tr", "es", "it", "ru", "zh-CN", "ja"];
	const langName = (code) => { try { return new Intl.DisplayNames([I18n.locale], { type: "language" }).of(code) || code; } catch { return code; } };
	function fillTrLangs() {
		const from = setting("trFrom", "auto"), to = setting("trTo", I18n.lang === "fa" ? "en" : "fa");
		$("trFrom").replaceChildren(el("option", { value: "auto" }, t("trAuto")), ...TR_LANGS.map((c) => el("option", { value: c }, langName(c))));
		$("trTo").replaceChildren(...TR_LANGS.map((c) => el("option", { value: c }, langName(c))));
		$("trFrom").value = from;
		$("trTo").value = to;
	}
	const isPersian = (s) => /[؀-ۿ]/.test(s);
	let trTimer = 0, trSeq = 0;
	async function translate() {
		const q = $("trIn").value.trim();
		let from = $("trFrom").value, to = $("trTo").value;
		// Auto: Persian text goes to the chosen language; anything else comes back to Persian (or to the chosen one).
		if (from === "auto" && q) {
			if (isPersian(q) && to === "fa") to = I18n.lang === "fa" ? "en" : I18n.lang;
			else if (!isPersian(q) && to === "en") to = "fa";
		}
		$("trOpen").href = `https://translate.google.com/?sl=${from}&tl=${to}&text=${encodeURIComponent(q)}&op=translate`;
		if (!q) return $("trOut").replaceChildren();
		const seq = ++trSeq;
		$("trOut").replaceChildren(el("span", { class: "muted" }, t("loading")));
		try {
			const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t&q=${encodeURIComponent(q)}`);
			if (!r.ok) throw new Error(r.status);
			const d = await r.json();
			if (seq !== trSeq) return;
			const text = (d[0] || []).map((x) => x[0]).join("");
			$("trOut").replaceChildren(el("div", { dir: "auto" }, text), el("small", { class: "muted" }, langName(d[2] || from) + " → " + langName(to)));
			$("trOut").dataset.text = text;
		} catch {
			if (seq === trSeq) $("trOut").replaceChildren(el("span", { class: "error" }, t("trFail")));
		}
	}
	function openTranslator(text) {
		fillTrLangs();
		const sel = String(getSelection() || "").trim();
		$("trIn").value = text || sel || $("trIn").value || "";
		$("trDialog").open || $("trDialog").showModal();
		$("trIn").focus();
		$("trIn").select();
		if ($("trIn").value) translate();
	}
	H.openTranslator = openTranslator;
	$("trIn").addEventListener("input", () => { clearTimeout(trTimer); trTimer = setTimeout(translate, 500); });
	$("trIn").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); translate(); } });
	$("trGo").addEventListener("click", translate);
	$("trFrom").addEventListener("change", (e) => { Store.setSetting("trFrom", e.target.value); translate(); });
	$("trTo").addEventListener("change", (e) => { Store.setSetting("trTo", e.target.value); translate(); });
	$("trSwap").addEventListener("click", () => {
		const f = $("trFrom").value === "auto" ? (isPersian($("trIn").value) ? "fa" : "en") : $("trFrom").value;
		const out = $("trOut").dataset.text;
		Store.setSetting("trFrom", $("trTo").value);
		Store.setSetting("trTo", f);
		fillTrLangs();
		if (out) $("trIn").value = out;
		translate();
	});
	$("trCopy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("trOut").dataset.text || ""); toast(t("copied")); } catch {} });
	$("trBtn").addEventListener("click", () => openTranslator());
	// Alt+T opens it from anywhere on the page, even while typing; "l" when nothing is focused.
	document.addEventListener("keydown", (e) => {
		if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "t" || e.key === "T" || e.code === "KeyT")) {
			e.preventDefault();
			openTranslator(document.activeElement === $("searchInput") ? $("searchInput").value.trim() : "");
		}
	});

	/* ---------- football (TheSportsDB public API) ---------- */
	const SDB = "https://www.thesportsdb.com/api/v1/json/123/";
	const FB_SUGGEST = ["Persepolis", "Esteghlal", "Iran", "Sepahan", "Tractor", "Real Madrid", "Barcelona", "Manchester City", "Liverpool", "Bayern Munich"];
	const teams = () => setting("fbTeams", []) || [];
	const FB_TTL = 30 * 60 * 1000;
	async function fbGet(path) {
		const r = await fetch(SDB + path);
		if (!r.ok) throw new Error(r.status);
		return r.json();
	}
	async function fbTeam(team, force) {
		const key = "kamyar_fb_" + team.id;
		const cached = hasLocal() ? (await chrome.storage.local.get(key))[key] : null;
		if (!force && cached && Date.now() - cached.at < FB_TTL) return cached;
		const [last, next] = await Promise.all([fbGet("eventslast.php?id=" + team.id).catch(() => ({})), fbGet("eventsnext.php?id=" + team.id).catch(() => ({}))]);
		const v = { at: Date.now(), last: (last.results || last.events || []).slice(0, 3), next: (next.events || []).slice(0, 2) };
		if (!v.last.length && !v.next.length && cached) return { ...cached, stale: true };
		if (hasLocal()) await chrome.storage.local.set({ [key]: v });
		return v;
	}
	const evTime = (x) => {
		const iso = x.strTimestamp ? x.strTimestamp.replace(/\+00:00$/, "") + "Z" : x.dateEvent + "T" + (x.strTime || "12:00:00").slice(0, 8) + "Z";
		const d = new Date(iso);
		return isNaN(d) ? null : d;
	};
	const whenFmt = (d) => new Intl.DateTimeFormat(I18n.locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
	function matchRow(x, team, past) {
		const d = evTime(x);
		const home = x.strHomeTeam, away = x.strAwayTeam;
		const score = past && x.intHomeScore != null ? `${num(Number(x.intHomeScore))} – ${num(Number(x.intAwayScore))}` : "–";
		let res = "";
		if (past && x.intHomeScore != null) {
			const mine = home === team.name ? [x.intHomeScore, x.intAwayScore] : [x.intAwayScore, x.intHomeScore];
			res = Number(mine[0]) > Number(mine[1]) ? "w" : Number(mine[0]) < Number(mine[1]) ? "l" : "d";
		}
		return el("li", { class: "fb-match" + (res ? " r-" + res : "") },
			el("span", { class: "fb-team", dir: "auto" }, home), el("strong", { class: "fb-score", dir: "ltr" }, score), el("span", { class: "fb-team", dir: "auto" }, away),
			el("small", { class: "muted fb-when" }, (d ? whenFmt(d) : x.dateEvent || "") + (x.strLeague ? " · " + x.strLeague : "")));
	}
	async function drawFootball(force) {
		if (!H.widgetOn("football")) return;
		const list = teams();
		if (!list.length) {
			$("fbList").replaceChildren(el("p", { class: "muted small" }, t("fbEmpty")), el("div", { class: "fb-suggest" }, ...FB_SUGGEST.slice(0, 6).map((n) => el("button", { type: "button", class: "chip", onclick: () => { $("fbInput").value = n; $("fbForm").requestSubmit(); } }, n))));
			return;
		}
		$("fbList").replaceChildren(...list.map((tm) => el("div", { class: "fb-card", "data-id": tm.id },
			el("div", { class: "fb-head" }, tm.badge ? el("img", { src: tm.badge + "/tiny", alt: "", width: "26", height: "26", loading: "lazy", onerror: (e) => (e.target.style.visibility = "hidden") }) : el("span", {}, "⚽"), el("strong", { class: "grow", dir: "auto" }, tm.name),
				el("button", { type: "button", class: "icon-btn small", title: t("delete"), "aria-label": t("delete"), onclick: () => Store.setSetting("fbTeams", teams().filter((x) => x.id !== tm.id)) }, "✕")),
			el("p", { class: "muted small" }, t("loading")))));
		for (const tm of list) {
			const box = $("fbList").querySelector(`[data-id="${CSS.escape(tm.id)}"]`);
			try {
				const v = await fbTeam(tm, force);
				const rows = [
					...(v.next.length ? [el("small", { class: "fb-label" }, t("fbNext")), el("ul", { class: "fb-matches" }, ...v.next.map((x) => matchRow(x, tm, false)))] : []),
					...(v.last.length ? [el("small", { class: "fb-label" }, t("fbLast")), el("ul", { class: "fb-matches" }, ...v.last.map((x) => matchRow(x, tm, true)))] : []),
				];
				box.lastChild.replaceWith(rows.length ? el("div", {}, ...rows) : el("p", { class: "muted small" }, t("fbNone")));
			} catch {
				box.lastChild.replaceWith(el("p", { class: "error small" }, t("ratesFail")));
			}
		}
	}
	$("fbForm").addEventListener("submit", async (e) => {
		e.preventDefault();
		const q = $("fbInput").value.trim();
		if (!q) return;
		const out = $("fbResults");
		out.hidden = false;
		out.replaceChildren(el("li", { class: "muted small" }, t("searching")));
		try {
			const d = await fbGet("searchteams.php?t=" + encodeURIComponent(q));
			const found = (d.teams || []).filter((x) => !x.strSport || x.strSport === "Soccer").slice(0, 8);
			if (!found.length) return out.replaceChildren(el("li", { class: "muted small" }, t("fbNotFound")));
			out.replaceChildren(...found.map((x) => el("li", {}, el("button", { type: "button", class: "wx-pick", onclick: () => {
				out.hidden = true;
				$("fbInput").value = "";
				if (teams().some((y) => y.id === x.idTeam)) return;
				Store.setSetting("fbTeams", [...teams(), { id: x.idTeam, name: x.strTeam, badge: x.strBadge || x.strTeamBadge || "" }]);
			} }, [x.strTeam, x.strLeague, x.strCountry].filter(Boolean).join(" · ")))));
		} catch {
			out.replaceChildren(el("li", { class: "error small" }, t("searchFail")));
		}
	});
	$("fbRefresh").addEventListener("click", () => drawFootball(true));

	/* ---------- family calendar: share events and birthdays by file or code ---------- */
	const shareable = () => Store.list("event").sort((a, b) => (a.kind === b.kind ? (a.date || "").localeCompare(b.date || "") : a.kind === "birthday" ? -1 : 1));
	const FIELDS = ["kind", "title", "date", "allDay", "start", "end", "repeat", "cal", "year", "color", "desc"];
	const picked = new Set();
	function drawShare() {
		const list = shareable();
		$("shPick").replaceChildren(...(list.length ? list.map((ev) => el("label", { class: "check sh-row" },
			el("input", { type: "checkbox", checked: picked.has(ev.id), onchange: (e) => (e.target.checked ? picked.add(ev.id) : picked.delete(ev.id)) }),
			el("span", {}, ev.kind === "birthday" ? "🎂" : "📅"), el("span", { dir: "auto", class: "grow" }, ev.title), el("small", { class: "muted" }, H.fmtDate(new Date(ev.date + "T12:00"), H.calOrder()[0], false)))) : [el("p", { class: "muted small" }, t("shNothing"))]));
	}
	async function packCode(obj) {
		const bytes = new TextEncoder().encode(JSON.stringify(obj));
		const gz = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
		let bin = "";
		gz.forEach((b) => (bin += String.fromCharCode(b)));
		return "KAMYAR1:" + btoa(bin);
	}
	async function unpackCode(code) {
		const b64 = code.trim().replace(/^KAMYAR1:/, "").replace(/\s+/g, "");
		const bin = atob(b64);
		const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
		return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).text());
	}
	function payload() {
		const items = shareable().filter((x) => picked.has(x.id)).map((x) => Object.fromEntries(FIELDS.filter((k) => x[k] !== undefined && x[k] !== "").map((k) => [k, x[k]])));
		return { kamyar: "share", v: 1, from: setting("name", "") || "", at: new Date().toISOString(), items };
	}
	function importShare(obj) {
		if (!obj || obj.kamyar !== "share" || !Array.isArray(obj.items)) throw new Error("bad");
		const have = new Set(Store.list("event").map((x) => `${x.kind}|${x.title}|${x.date}`));
		let added = 0, skipped = 0;
		for (const it of obj.items.slice(0, 500)) {
			if (!it || !it.title || !/^\d{4}-\d{2}-\d{2}$/.test(it.date || "")) continue;
			const sig = `${it.kind || "event"}|${it.title}|${it.date}`;
			if (have.has(sig)) { skipped++; continue; }
			have.add(sig);
			const ev = Object.fromEntries(FIELDS.filter((k) => it[k] !== undefined).map((k) => [k, it[k]]));
			Store.add("event", { kind: "event", remind: it.kind === "birthday" ? 0 : 15, ...ev, title: String(ev.title).slice(0, 200), desc: String(ev.desc || "").slice(0, 2000), sharedFrom: String(obj.from || "").slice(0, 40) });
			added++;
		}
		return { added, skipped, from: obj.from };
	}
	function openShare() {
		picked.clear();
		shareable().filter((x) => x.kind === "birthday").forEach((x) => picked.add(x.id));
		drawShare();
		$("shCode").value = "";
		$("shMsg").textContent = "";
		$("settingsDialog").open && $("settingsDialog").close();
		$("shareDialog").showModal();
	}
	H.openShare = openShare;
	$("shOpenSet").addEventListener("click", openShare);
	$("shAll").addEventListener("click", () => { const all = shareable(); const every = all.every((x) => picked.has(x.id)); all.forEach((x) => (every ? picked.delete(x.id) : picked.add(x.id))); drawShare(); });
	$("shCopy").addEventListener("click", async () => {
		const p = payload();
		if (!p.items.length) return toast(t("shPickSome"));
		const code = await packCode(p);
		try { await navigator.clipboard.writeText(code); toast(t("shCopied", { n: num(p.items.length) })); } catch { $("shCode").value = code; $("shCode").select(); }
	});
	$("shFile").addEventListener("click", () => {
		const p = payload();
		if (!p.items.length) return toast(t("shPickSome"));
		const a = el("a", { href: URL.createObjectURL(new Blob([JSON.stringify(p, null, 1)], { type: "application/json" })), download: `kamyar-family-calendar-${new Date().toISOString().slice(0, 10)}.json` });
		a.click();
		setTimeout(() => URL.revokeObjectURL(a.href), 1000);
	});
	function showResult(r) {
		$("shMsg").className = "small ok";
		$("shMsg").textContent = (r.added ? t("shImported", { n: num(r.added) }) + " " : "") + (r.skipped ? t("shSkipped", { n: num(r.skipped) }) : "") + (r.from ? " · " + t("shFrom", { name: r.from }) : "");
	}
	function showBad() {
		$("shMsg").className = "small error";
		$("shMsg").textContent = t("shBad");
	}
	$("shImport").addEventListener("click", async () => {
		const code = $("shCode").value.trim();
		if (!code) return;
		try { showResult(importShare(code.startsWith("{") ? JSON.parse(code) : await unpackCode(code))); } catch { showBad(); }
	});
	$("shFileIn").addEventListener("change", async (e) => {
		const f = e.target.files[0];
		e.target.value = "";
		if (!f) return;
		try { showResult(importShare(JSON.parse(await f.text()))); } catch { showBad(); }
	});

	/* ---------- settings toggles ---------- */
	$("smartBmChk").addEventListener("change", (e) => Store.setSetting("smartBm", e.target.checked));
	$("seasonalChk").addEventListener("change", (e) => Store.setSetting("seasonal", e.target.checked));

	let fbSig = "";
	H.onRefresh(() => {
		$("smartBmChk").checked = !!setting("smartBm", false);
		$("seasonalChk").checked = setting("seasonal", true) !== false;
		drawSeason();
		const s = JSON.stringify([teams(), I18n.lang, H.widgetOn("football")]);
		if (s !== fbSig) { fbSig = s; drawFootball(); }
		if ($("shareDialog").open) drawShare();
	});
	(window.hamyarReady || Promise.resolve()).then(() => {
		drawSeason();
		setInterval(drawSeason, 10 * 60 * 1000);
	});
})();
