/* Kamyar v2.12: long-term goals, gratitude journal, world clock and the trip / big-event countdown. */
(function () {
	"use strict";
	const { $, el, num, setting, toast } = H;
	const pad = (n) => String(n).padStart(2, "0");
	const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const atNoon = (k) => new Date(k + "T12:00");
	const daysBetween = (a, b) => Math.round((atNoon(b) - atNoon(a)) / 864e5);
	const fmt = (k) => H.fmtDate(atNoon(k), H.calOrder()[0], false);
	const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} return null; };

	// Close buttons inside dialogs (data-close).
	document.addEventListener("click", (e) => { const b = e.target.closest("[data-close]"); if (b) b.closest("dialog")?.close(); });

	/* ---------- long-term goals ---------- */
	function forecast(g) {
		const today = dkey();
		const total = Math.max(1, daysBetween(g.start, g.end));
		const elapsed = Math.min(total, Math.max(1, daysBetween(g.start, today) + 1));
		const left = Math.max(0, daysBetween(today, g.end));
		const done = Number(g.done || 0), target = Number(g.target || 1);
		const unit = g.unit ? " " + g.unit : "";
		const n = (v) => num(Math.round(v * 10) / 10);
		if (done >= target) return { cls: "done", text: t("goalReached") };
		if (left <= 0 && today > g.end) return { cls: "late", text: t("goalOver", { n: n(target - done) + unit }) };
		const projected = (done / elapsed) * total;
		const need = (target - done) / Math.max(1, left);
		const per = need >= 1 || left < 14 ? t("goalPerDay", { n: n(need) + unit }) : t("goalPerWeek", { n: n(need * 7) + unit });
		if (projected >= target) return { cls: "ok", text: t("goalOnTrack", { n: n(projected) + unit }) + " " + per };
		return { cls: "behind", text: t("goalBehind", { n: n(projected) + unit }) + " " + per };
	}
	function drawGoals() {
		const list = Store.list("goal").sort((a, b) => (a.end || "").localeCompare(b.end || ""));
		$("goalList").replaceChildren(...(list.length ? list.map((g) => {
			const pct = Math.min(100, Math.round((Number(g.done || 0) / Number(g.target || 1)) * 100));
			const f = forecast(g);
			const step = el("input", { type: "number", class: "goal-step", value: "1", min: "0", step: "any", "aria-label": t("goalAdd") });
			return el("div", { class: "goal " + f.cls },
				el("div", { class: "goal-top" },
					el("span", { class: "goal-ic" }, g.emoji || "🎯"),
					el("strong", { dir: "auto", class: "grow" }, g.title),
					el("span", { class: "goal-num" }, `${num(Number(g.done || 0))} / ${num(Number(g.target))}${g.unit ? " " + g.unit : ""}`),
					el("button", { type: "button", class: "icon-btn small", title: t("delete"), "aria-label": t("delete"), onclick: () => { const snap = { ...g }; delete snap.id; Store.remove(g.id); toast(t("goalDeleted"), { run: () => Store.add("goal", snap) }); } }, "✕")),
				el("div", { class: "goal-bar" }, el("i", { style: `width:${pct}%` }), el("span", { class: "goal-time", style: `inset-inline-start:${Math.min(100, Math.round((Math.max(0, daysBetween(g.start, dkey())) / Math.max(1, daysBetween(g.start, g.end))) * 100))}%`, title: t("goalToday") })),
				el("div", { class: "goal-foot" },
					el("small", { class: "goal-fc grow" }, num(pct) + "% · " + f.text + " · " + t("goalUntil", { d: fmt(g.end) })),
					step,
					el("button", { type: "button", class: "btn small", onclick: () => {
						const v = Number(step.value) || 0;
						if (!v) return;
						const k = dkey();
						Store.update(g.id, { done: Math.max(0, Number(g.done || 0) + v), log: { ...(g.log || {}), [k]: ((g.log || {})[k] || 0) + v } });
					} }, "+")));
		}) : [el("p", { class: "muted small" }, t("goalEmpty"))]));
	}
	$("goalForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const end = $("goalEnd").value;
		if (!end || end <= dkey()) return toast(t("goalBadDate"));
		Store.add("goal", { title: $("goalTitle").value.trim(), emoji: $("goalEmoji").value.trim(), target: Number($("goalTarget").value), unit: $("goalUnit").value.trim(), done: 0, start: dkey(), end, log: {} });
		$("goalForm").reset();
	});

	/* ---------- gratitude journal ---------- */
	const journalOf = (k) => Store.list("journal").find((x) => x.date === k);
	function drawJournal() {
		const j = journalOf(dkey());
		const inputs = [...document.querySelectorAll("#journalForm .j-line")];
		if (!inputs.some((i) => i === document.activeElement)) inputs.forEach((inp, i) => (inp.value = (j && j.lines[i]) || ""));
		$("journalSaved").textContent = j ? t("jSavedToday") : "";
		let streak = 0;
		for (let i = j ? 0 : 1; ; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (!journalOf(dkey(d))) break; streak++; }
		$("journalStreak").textContent = streak ? t("jStreak", { n: num(streak) }) : "";
	}
	$("journalForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const lines = [...document.querySelectorAll("#journalForm .j-line")].map((i) => i.value.trim());
		if (!lines.some(Boolean)) return;
		const j = journalOf(dkey());
		if (j) Store.update(j.id, { lines });
		else Store.add("journal", { date: dkey(), lines });
		document.activeElement?.blur();
		toast(t("jSaved"));
	});
	// Review by month of the main calendar.
	const monthKey = (k) => {
		const cal = H.calOrder()[0];
		const p = Object.fromEntries(new Intl.DateTimeFormat("en-u-ca-" + cal + "-nu-latn", { year: "numeric", month: "numeric" }).formatToParts(atNoon(k)).map((x) => [x.type, x.value]));
		return `${p.relatedYear || p.year}-${pad(p.month)}`;
	};
	let jMonth = null;
	function drawReview() {
		const all = Store.list("journal").sort((a, b) => b.date.localeCompare(a.date));
		const months = [...new Set([monthKey(dkey()), ...all.map((x) => monthKey(x.date))])].sort().reverse();
		if (!jMonth || !months.includes(jMonth)) jMonth = months[0];
		const i = months.indexOf(jMonth);
		const items = all.filter((x) => monthKey(x.date) === jMonth);
		const sample = items[0] ? atNoon(items[0].date) : new Date();
		$("journalDlgTitle").textContent = "📖 " + new Intl.DateTimeFormat(I18n.locale + "-u-ca-" + H.calOrder()[0], { month: "long", year: "numeric" }).format(sample);
		$("jPrev").disabled = i >= months.length - 1;
		$("jNext").disabled = i <= 0;
		$("journalDlgBody").replaceChildren(
			el("p", { class: "muted small" }, t("jMonthCount", { n: num(items.length), lines: num(items.reduce((a, x) => a + x.lines.filter(Boolean).length, 0)) })),
			...(items.length ? items.map((x) => el("div", { class: "jr-day" }, el("strong", {}, fmt(x.date)), el("ul", {}, ...x.lines.filter(Boolean).map((l) => el("li", { dir: "auto" }, l))))) : [el("p", { class: "muted" }, t("jEmpty"))]));
	}
	$("journalReview").addEventListener("click", () => { jMonth = null; drawReview(); $("journalDialog").showModal(); });
	$("jPrev").addEventListener("click", () => { const all = [...document.querySelectorAll(".jr-day")]; void all; const ms = [...new Set([monthKey(dkey()), ...Store.list("journal").map((x) => monthKey(x.date))])].sort().reverse(); jMonth = ms[Math.min(ms.length - 1, ms.indexOf(jMonth) + 1)]; drawReview(); });
	$("jNext").addEventListener("click", () => { const ms = [...new Set([monthKey(dkey()), ...Store.list("journal").map((x) => monthKey(x.date))])].sort().reverse(); jMonth = ms[Math.max(0, ms.indexOf(jMonth) - 1)]; drawReview(); });
	// Evening nudge, once a day, when today's three lines are still empty.
	function journalNudge() {
		if (!H.widgetOn("journal") || new Date().getHours() < 20 || journalOf(dkey()) || ls("kamyar_journal_nudge") === dkey()) return;
		if (document.querySelector("dialog[open]") || H.tourOpen?.()) return;
		ls("kamyar_journal_nudge", dkey());
		const card = el("div", { class: "care-card journal-nudge", role: "status" }, el("span", { class: "care-ic" }, "🙏"),
			el("div", { class: "care-body" }, el("strong", {}, t("jNudgeTitle")), el("p", {}, t("jPrompt")),
				el("div", { class: "care-actions" }, el("button", { type: "button", class: "btn small", onclick: () => { card.remove(); H.showView("tools"); document.querySelector('[data-widget="journal"]').scrollIntoView({ block: "center" }); document.querySelector("#journalForm .j-line").focus(); } }, t("jWrite")))),
			el("button", { type: "button", class: "care-x", "aria-label": t("close"), title: t("close"), onclick: () => card.remove() }, "✕"));
		$("careStack").append(card);
		requestAnimationFrame(() => card.classList.add("in"));
	}

	/* ---------- world clock ---------- */
	const CITY_FA = { "Asia/Tehran": "تهران", "Europe/London": "لندن", "America/New_York": "نیویورک", "Europe/Berlin": "برلین", "Europe/Paris": "پاریس", "Europe/Zurich": "زوریخ", "Asia/Dubai": "دبی", "Europe/Istanbul": "استانبول", "Asia/Tokyo": "توکیو", "America/Los_Angeles": "لس‌آنجلس", "America/Toronto": "تورنتو", "Australia/Sydney": "سیدنی", "Asia/Shanghai": "شانگهای", "Europe/Moscow": "مسکو", "Asia/Kabul": "کابل", "Europe/Stockholm": "استکهلم", "Europe/Vienna": "وین", "Europe/Amsterdam": "آمستردام", "America/Vancouver": "ونکوور", "Asia/Kolkata": "دهلی", "Europe/Rome": "رم", "Europe/Madrid": "مادرید", "America/Chicago": "شیکاگو" };
	const ZONES = (() => { try { return Intl.supportedValuesOf("timeZone"); } catch { return Object.keys(CITY_FA); } })();
	const cityName = (tz) => (I18n.lang === "fa" && CITY_FA[tz]) || tz.split("/").pop().replace(/_/g, " ");
	const clocks = () => setting("worldClocks", null) || [{ tz: "Asia/Tehran" }, { tz: "Europe/London" }, { tz: "America/New_York" }];
	const offsetMin = (tz, d = new Date()) => {
		const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
		return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - d.getTime()) / 60000);
	};
	function drawClocks() {
		const now = new Date();
		const here = -now.getTimezoneOffset();
		$("wcList").replaceChildren(...clocks().map((c, i) => {
			let tf;
			try { tf = new Intl.DateTimeFormat(I18n.locale, { timeZone: c.tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); } catch { return ""; }
			const off = offsetMin(c.tz, now);
			const diff = off - here;
			const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: c.tz, hour: "numeric", hourCycle: "h23" }).format(now)) % 24;
			const dayShift = Math.floor((now.getHours() * 60 + now.getMinutes() + diff) / 1440);
			const rel = diff === 0 ? t("wcSame") : (diff > 0 ? "+" : "−") + num(Math.floor(Math.abs(diff) / 60)) + (Math.abs(diff) % 60 ? ":" + num(Math.abs(diff) % 60, { minimumIntegerDigits: 2 }) : "") + " " + t("wcHours");
			return el("li", { class: "wc" + (h >= 7 && h < 19 ? " day" : " night") },
				el("span", { class: "wc-ic" }, h >= 7 && h < 19 ? "☀️" : "🌙"),
				el("div", { class: "grow" }, el("strong", { dir: "auto" }, c.name || cityName(c.tz)), el("small", { class: "muted" }, rel + (dayShift ? " · " + t(dayShift > 0 ? "wcTomorrow" : "wcYesterday") : ""))),
				el("span", { class: "wc-time" }, tf.format(now)),
				el("button", { type: "button", class: "icon-btn small", title: t("delete"), "aria-label": t("delete"), onclick: () => Store.setSetting("worldClocks", clocks().filter((_, k) => k !== i)) }, "✕"));
		}));
	}
	function fillZones() {
		$("wcZones").replaceChildren(...ZONES.map((z) => el("option", { value: z }, cityName(z))));
	}
	$("wcForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const q = $("wcInput").value.trim();
		if (!q) return;
		const norm = (s) => s.toLowerCase().replace(/[_\s]+/g, " ");
		const tz = ZONES.find((z) => z.toLowerCase() === q.toLowerCase()) || ZONES.find((z) => norm(z.split("/").pop()) === norm(q)) || Object.keys(CITY_FA).find((z) => CITY_FA[z] === q) || ZONES.find((z) => norm(z).includes(norm(q)));
		if (!tz) return toast(t("wcNotFound"));
		if (clocks().some((c) => c.tz === tz)) return toast(t("wcHave"));
		Store.setSetting("worldClocks", [...clocks(), { tz }]);
		$("wcInput").value = "";
	});

	/* ---------- trip / big event countdown (home) ---------- */
	const tripImg = (id) => ls("kamyar_trip_img_" + id);
	let tripIdx = 0, editingTrip = null, pendingImg = undefined;
	function upcomingTrips() {
		const today = dkey();
		return Store.list("trip").filter((x) => x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
	}
	function drawTrip() {
		const card = $("tripCard");
		const list = upcomingTrips();
		if (!list.length) {
			card.classList.add("empty");
			card.style.removeProperty("--trip-img");
			card.replaceChildren(el("button", { type: "button", class: "trip-add", onclick: () => openTrip(null) }, "✈️ ", t("tripAddCta")));
			return;
		}
		card.classList.remove("empty");
		tripIdx = Math.min(tripIdx, list.length - 1);
		const x = list[tripIdx];
		const left = daysBetween(dkey(), x.date);
		const img = tripImg(x.id);
		card.classList.toggle("has-img", !!img);
		if (img) card.style.setProperty("--trip-img", `url("${img}")`);
		else card.style.removeProperty("--trip-img");
		card.replaceChildren(
			el("div", { class: "trip-main" },
				el("span", { class: "trip-emoji" }, x.emoji || "✈️"),
				el("div", { class: "trip-text" },
					el("div", { class: "trip-days" }, left === 0 ? t("tripToday") : el("span", {}, el("b", {}, num(left)), " ", t(left === 1 ? "tripDay" : "tripDays"))),
					el("div", { class: "trip-title", dir: "auto" }, left === 0 ? x.title : t("tripTo", { title: x.title })),
					el("small", { class: "trip-date" }, fmt(x.date)))),
			el("div", { class: "trip-tools" },
				list.length > 1 ? el("span", { class: "trip-dots" }, ...list.map((_, i) => el("button", { type: "button", class: i === tripIdx ? "on" : "", "aria-label": String(i + 1), onclick: () => { tripIdx = i; drawTrip(); } }))) : "",
				el("button", { type: "button", class: "icon-btn small", title: t("add"), "aria-label": t("add"), onclick: () => openTrip(null) }, "+"),
				el("button", { type: "button", class: "icon-btn small", title: t("edit"), "aria-label": t("edit"), onclick: () => openTrip(x) }, "✎")));
	}
	/* Ready-made countdowns: the date is worked out from the Persian or Gregorian calendar. */
	function persianMD(d) {
		const p = Object.fromEntries(new Intl.DateTimeFormat("en-u-ca-persian-nu-latn", { month: "numeric", day: "numeric" }).formatToParts(d).map((x) => [x.type, x.value]));
		return [Number(p.month), Number(p.day)];
	}
	// First day from tomorrow on that passes test(d); null within ~400 days.
	function nextDay(test) {
		const d = new Date(); d.setHours(12, 0, 0, 0);
		for (let i = 1; i < 400; i++) { d.setDate(d.getDate() + 1); if (test(d)) return dkey(d); }
		return null;
	}
	const dayBefore = (k) => { const d = atNoon(k); d.setDate(d.getDate() - 1); return dkey(d); };
	const pFirst = (months) => nextDay((d) => { const [m, day] = persianMD(d); return day === 1 && months.includes(m); });
	const PRESETS = [
		["cdYearEndFa", "🗓️", () => dayBefore(pFirst([1]))],
		["cdNowruz", "🌱", () => pFirst([1])],
		["cdSeasonEnd", "🍂", () => dayBefore(pFirst([1, 4, 7, 10]))],
		["cdSummerEnd", "☀️", () => dayBefore(pFirst([7]))],
		["cdYalda", "🍉", () => dayBefore(pFirst([10]))],
		["cdMonthEnd", "📅", () => dayBefore(nextDay((d) => Number(new Intl.DateTimeFormat("en-u-ca-" + H.calOrder()[0] + "-nu-latn", { day: "numeric" }).format(d)) === 1))],
		["cdYearEndEn", "🎆", () => nextDay((d) => d.getMonth() === 11 && d.getDate() === 31) || dkey()],
		["cdWeekEnd", "🎉", () => nextDay((d) => d.getDay() === (setting("iranHolidays", true) ? 5 : 6))],
		["cdTermEnd", "🎓", () => ""],
		["cdTrip", "✈️", () => ""]
	];
	function dateHint() {
		const v = $("tripDate").value;
		$("tripDateHint").textContent = v ? fmt(v) + " · " + t("tripInDays", { n: num(daysBetween(dkey(), v)) }) : "";
	}
	$("tripDate").addEventListener("input", dateHint);
	function drawPresets() {
		$("tripPresets").replaceChildren(...PRESETS.map(([k, emoji, date]) => el("button", { type: "button", class: "chip", onclick: () => {
			$("tripTitle").value = t(k);
			$("tripEmoji").value = emoji;
			const d = date();
			$("tripDate").value = d || "";
			dateHint();
			(d ? $("tripTitle") : $("tripDate")).focus();
			if (!d) try { $("tripDate").showPicker(); } catch {}
		} }, emoji + " " + t(k))));
	}
	function openTrip(x) {
		drawPresets();
		$("tripPresets").hidden = !!x;
		editingTrip = x;
		pendingImg = undefined;
		$("tripTitle").value = x ? x.title : "";
		$("tripDate").value = x ? x.date : "";
		$("tripDate").min = dkey();
		$("tripEmoji").value = x ? x.emoji || "" : "";
		$("tripDelete").hidden = !x;
		$("tripPhotoRm").hidden = !(x && tripImg(x.id));
		dateHint();
		$("tripDialog").showModal();
		$("tripTitle").focus();
	}
	$("tripPhoto").addEventListener("change", (e) => {
		const f = e.target.files[0];
		e.target.value = "";
		if (!f || !/^image\//.test(f.type)) return;
		const url = URL.createObjectURL(f);
		const im = new Image();
		im.onload = () => {
			URL.revokeObjectURL(url);
			const s = Math.min(1, 1000 / Math.max(im.naturalWidth, im.naturalHeight));
			const c = document.createElement("canvas");
			c.width = Math.round(im.naturalWidth * s);
			c.height = Math.round(im.naturalHeight * s);
			c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
			pendingImg = c.toDataURL("image/jpeg", 0.8);
			$("tripPhotoRm").hidden = false;
			toast(t("tripPhotoOk"));
		};
		im.onerror = () => { URL.revokeObjectURL(url); toast(t("wallBad")); };
		im.src = url;
	});
	$("tripPhotoRm").addEventListener("click", () => { pendingImg = null; $("tripPhotoRm").hidden = true; });
	$("tripForm").addEventListener("submit", (e) => {
		if (e.submitter && e.submitter.value !== "save") return;
		const v = { title: $("tripTitle").value.trim(), date: $("tripDate").value, emoji: $("tripEmoji").value.trim() };
		if (!v.title || !v.date) return e.preventDefault();
		const x = editingTrip ? (Store.update(editingTrip.id, v), editingTrip) : Store.add("trip", v);
		if (pendingImg !== undefined) {
			try { ls("kamyar_trip_img_" + x.id, pendingImg); } catch { toast(t("wallTooBig")); }
		}
		tripIdx = Math.max(0, upcomingTrips().findIndex((y) => y.id === x.id));
		drawTrip();
	});
	$("tripDelete").addEventListener("click", () => {
		if (!editingTrip) return;
		const snap = { ...editingTrip };
		delete snap.id;
		const img = tripImg(editingTrip.id);
		Store.remove(editingTrip.id);
		ls("kamyar_trip_img_" + editingTrip.id, null);
		$("tripDialog").close();
		toast(t("tripDeleted"), { run: () => { const y = Store.add("trip", snap); if (img) ls("kamyar_trip_img_" + y.id, img); } });
	});

	H.onRefresh(() => { drawGoals(); drawJournal(); drawClocks(); drawTrip(); });
	setInterval(() => { if (document.visibilityState === "visible") drawClocks(); }, 20000);
	(window.hamyarReady || Promise.resolve()).then(() => {
		fillZones();
		drawGoals(); drawJournal(); drawClocks(); drawTrip();
		setTimeout(journalNudge, 3000);
	});
})();
