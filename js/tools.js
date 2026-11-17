/* Small tools, as in Dastyar: date converter, age calculator, countdown timer, stopwatch, and countdowns
 * to Nowruz, the Gregorian new year and your birthday. */
(function () {
	"use strict";
	const { $, el, num, setting } = H;
	const E = window.EvCore;
	const DAY = 86400000;
	const TAB_KEY = "hamyar_tool";
	const TIMER = "hamyar_timer";
	const CALS = ["persian", "gregory", "islamic-umalqura"];
	const calName = { persian: "calPersian", gregory: "calGregory", "islamic-umalqura": "calIslamic" };
	let tab = "convert";
	try {
		tab = localStorage.getItem(TAB_KEY) || "convert";
	} catch {}

	const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
	const two = (n) => new Intl.NumberFormat(I18n.locale, { minimumIntegerDigits: 2, useGrouping: false }).format(n);

	/** Converts a date in any of the three calendars to a Gregorian Date (noon), or null if it doesn't exist. */
	function toDate(cal, y, m, d) {
		y = Number(y); m = Number(m); d = Number(d);
		if (!y || !m || !d || m > 12 || d > 31) return null;
		if (cal === "gregory") {
			const g = new Date(y, m - 1, d, 12);
			return g.getMonth() === m - 1 ? g : null;
		}
		const est = cal === "persian" ? new Date(y + 621, 2, 21, 12) : new Date(Math.round(y * 0.970229 + 621.5643), 0, 1, 12);
		let g = new Date(est.getTime() + ((m - 1) * (cal === "persian" ? 30.44 : 29.53) + (d - 1)) * DAY);
		const ml = cal === "persian" ? 30.44 : 29.53;
		for (let i = 0; i < 8; i++) {
			const p = E.parts(cal, g);
			const diff = Math.round(((y - p.year) * 12 + (m - p.month)) * ml + (d - p.day));
			if (!diff) break;
			g = noon(new Date(g.getTime() + diff * DAY));
		}
		for (let k = -2; k <= 2; k++) {
			const c = noon(new Date(g.getTime() + k * DAY));
			const p = E.parts(cal, c);
			if (p.year === y && p.month === m && p.day === d) return c;
		}
		return null;
	}

	/* ---------- date input shared by converter and age ---------- */
	function dateInput(prefix, cal, val, onChange) {
		const p = val ? E.parts(cal, val) : { year: "", month: "", day: "" };
		const f = (k, ph, max) => el("input", { id: prefix + k, type: "number", inputmode: "numeric", min: 1, max, placeholder: ph, value: p[k] ?? "", oninput: onChange });
		return el("div", { class: "date-in" },
			el("select", { id: prefix + "cal", onchange: onChange }, ...CALS.map((c) => el("option", { value: c, selected: c === cal }, t(calName[c])))),
			f("day", t("dayPh"), 31), f("month", t("monthPh"), 12), f("year", t("yearPh"), 3000)
		);
	}
	const readInput = (prefix) => toDate($(prefix + "cal").value, $(prefix + "year").value, $(prefix + "month").value, $(prefix + "day").value);

	/* ---------- converter ---------- */
	function renderConvert(body) {
		const main = H.calOrder()[0];
		const out = el("div", { class: "tool-out" });
		const update = () => {
			const d = readInput("cv");
			if (!d) return out.replaceChildren(el("p", { class: "muted small" }, t("badDate")));
			out.replaceChildren(...CALS.map((c) => el("div", { class: "tool-row" }, el("span", { class: "muted" }, t(calName[c])), el("strong", {}, H.fmtDate(d, c, c === CALS[0])))));
		};
		body.replaceChildren(el("p", { class: "muted small" }, t("convertHint")), dateInput("cv", main, noon(new Date()), update), out);
		update();
	}

	/* ---------- age ---------- */
	const ZODIAC = ["zRat", "zOx", "zTiger", "zRabbit", "zDragon", "zSnake", "zHorse", "zGoat", "zMonkey", "zRooster", "zDog", "zPig"];
	function ageParts(birth, cal) {
		const now = noon(new Date());
		const b = E.parts(cal, birth), n = E.parts(cal, now);
		let y = n.year - b.year, m = n.month - b.month, d = n.day - b.day;
		if (d < 0) {
			m -= 1;
			// days in the previous month of that calendar
			const firstThis = toDate(cal, n.year, n.month, 1) || now;
			d += E.parts(cal, new Date(firstThis.getTime() - DAY)).day;
		}
		if (m < 0) { y -= 1; m += 12; }
		return { y, m, d };
	}
	function renderAge(body) {
		const main = H.calOrder()[0];
		const saved = setting("birthday", "");
		const out = el("div", { class: "tool-out" });
		const update = () => {
			const cal = $("agcal").value;
			const birth = readInput("ag");
			if (!birth || birth > new Date()) return out.replaceChildren(el("p", { class: "muted small" }, t("badDate")));
			const a = ageParts(birth, cal);
			const lived = Math.round((noon(new Date()) - birth) / DAY);
			const ev = { date: E.dstr(birth), repeat: "yearly", cal };
			let next = 0;
			for (; next < 400; next++) if (E.matches(ev, noon(new Date(Date.now() + next * DAY)))) break;
			const zy = E.parts("gregory", birth).year; // Chinese zodiac by Gregorian year (approximate around Lunar New Year)
			out.replaceChildren(
				el("div", { class: "tool-big" }, t("ageYMD", { y: num(a.y), m: num(a.m), d: num(a.d) })),
				el("div", { class: "tool-row" }, el("span", { class: "muted" }, t("daysLived")), el("strong", {}, num(lived))),
				el("div", { class: "tool-row" }, el("span", { class: "muted" }, t("nextBirthday")), el("strong", {}, next === 0 ? t("todayBday") : t("inNDays", { n: num(next) }))),
				el("div", { class: "tool-row" }, el("span", { class: "muted" }, t("zodiacYear")), el("strong", {}, t(ZODIAC[(((zy - 4) % 12) + 12) % 12]))),
				el("button", { type: "button", class: "link-btn", onclick: () => { Store.setSetting("birthday", { date: E.dstr(birth), cal }); H.toast(t("birthdaySaved")); } }, t("saveAsMyBirthday"))
			);
		};
		const initial = saved && saved.date ? E.noonOf(saved.date) : null;
		body.replaceChildren(el("p", { class: "muted small" }, t("ageHint")), dateInput("ag", (saved && saved.cal) || main, initial, update), out);
		update();
	}

	/* ---------- timer (survives closing the tab; the background worker notifies) ---------- */
	let tstate = { running: false, endAt: 0, remaining: 0, total: 0 };
	const tleft = () => (tstate.running ? Math.max(0, tstate.endAt - Date.now()) : tstate.remaining);
	const hms = (ms) => {
		const s = Math.ceil(ms / 1000);
		return `${two(Math.floor(s / 3600))}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
	};
	async function setTimer(next) {
		tstate = { ...tstate, ...next };
		await chrome.storage.local.set({ [TIMER]: tstate });
		await chrome.alarms.clear("hamyar-timer");
		if (tstate.running) chrome.alarms.create("hamyar-timer", { when: tstate.endAt });
		if (tab === "timer") render();
	}
	function renderTimer(body) {
		const ms = tleft();
		const idle = !tstate.running && !tstate.remaining;
		const num3 = (id, ph, max) => el("input", { id, type: "number", min: 0, max, placeholder: ph, inputmode: "numeric" });
		body.replaceChildren(
			idle
				? el("div", { class: "date-in timer-in" }, num3("tmH", t("hourPh"), 99), num3("tmM", t("minPh"), 59), num3("tmS", t("secPh"), 59))
				: el("div", { id: "tmShow", class: "tool-clock" }, hms(ms)),
			el("div", { class: "row center" },
				...(idle
					? [5, 10, 15, 30].map((m) => el("button", { type: "button", class: "btn btn-ghost small", onclick: () => setTimer({ running: true, total: m * 60000, endAt: Date.now() + m * 60000, remaining: m * 60000 }) }, t("nMin", { n: num(m) })))
					: [])
			),
			el("div", { class: "pomo-actions" },
				el("button", { type: "button", class: "btn", onclick: () => {
					if (idle) {
						const total = ((Number($("tmH").value) || 0) * 3600 + (Number($("tmM").value) || 0) * 60 + (Number($("tmS").value) || 0)) * 1000;
						if (total > 0) setTimer({ running: true, total, remaining: total, endAt: Date.now() + total });
					} else if (tstate.running) setTimer({ running: false, remaining: tleft() });
					else setTimer({ running: true, endAt: Date.now() + tstate.remaining });
				} }, t(idle ? "start" : tstate.running ? "pause" : "resume")),
				el("button", { type: "button", class: "btn btn-ghost", onclick: () => setTimer({ running: false, remaining: 0, total: 0, endAt: 0 }) }, t("reset"))
			)
		);
	}

	/* ---------- stopwatch (per tab) ---------- */
	const sw = { running: false, start: 0, acc: 0, laps: [] };
	const swNow = () => sw.acc + (sw.running ? Date.now() - sw.start : 0);
	const swText = (ms) => `${two(Math.floor(ms / 60000))}:${two(Math.floor((ms % 60000) / 1000))}.${two(Math.floor((ms % 1000) / 10))}`;
	function renderWatch(body) {
		body.replaceChildren(
			el("div", { id: "swShow", class: "tool-clock" }, swText(swNow())),
			el("div", { class: "pomo-actions" },
				el("button", { type: "button", class: "btn", onclick: () => { if (sw.running) { sw.acc = swNow(); sw.running = false; } else { sw.start = Date.now(); sw.running = true; } render(); } }, t(sw.running ? "pause" : swNow() ? "resume" : "start")),
				el("button", { type: "button", class: "btn btn-ghost", onclick: () => { if (sw.running) sw.laps.unshift(swNow()); else { sw.acc = 0; sw.laps = []; } render(); } }, t(sw.running ? "lap" : "reset"))
			),
			sw.laps.length ? el("ol", { class: "laps", reversed: true }, ...sw.laps.map((l) => el("li", {}, swText(l)))) : el("span")
		);
	}

	/* ---------- countdowns ---------- */
	function daysUntil(d) {
		return Math.round((noon(d) - noon(new Date())) / DAY);
	}
	function nextMatch(ev) {
		for (let i = 0; i < 400; i++) {
			const d = noon(new Date(Date.now() + i * DAY));
			if (E.matches(ev, d)) return d;
		}
		return null;
	}
	function renderCount(body) {
		const items = [];
		const nowruz = nextMatch({ date: "2025-03-21", repeat: "yearly", cal: "persian" });
		items.push([t("cdNowruz"), nowruz]);
		const ny = new Date(new Date().getFullYear() + 1, 0, 1, 12);
		items.push([t("cdNewYear"), ny]);
		const yalda = nextMatch({ date: "2025-12-21", repeat: "yearly", cal: "persian" }); // 30 Azar
		if (I18n.lang === "fa") items.push([t("cdYalda"), yalda]);
		const ramadan = nextMatch({ date: "2025-03-01", repeat: "yearly", cal: "islamic-umalqura" });
		items.push([t("cdRamadan"), ramadan]);
		const b = setting("birthday", "");
		if (b && b.date) items.push([t("cdMyBirthday"), nextMatch({ date: b.date, repeat: "yearly", cal: b.cal || "gregory" })]);
		body.replaceChildren(
			el("ul", { class: "count-list" },
				...items.filter(([, d]) => d).sort((a, b2) => a[1] - b2[1]).map(([name, d]) => {
					const n = daysUntil(d);
					return el("li", {}, el("span", {}, name, el("small", { class: "muted" }, H.fmtDate(d, H.calOrder()[0], false))), el("strong", {}, n === 0 ? t("todayBday") : t("inNDays", { n: num(n) })));
				})
			),
			...(b && b.date ? [] : [el("p", { class: "muted small" }, t("birthdayHint"))])
		);
	}

	const RENDER = { convert: renderConvert, age: renderAge, timer: renderTimer, watch: renderWatch, count: renderCount };
	function render() {
		if (!RENDER[tab]) tab = "convert";
		document.querySelectorAll(".tools-tabs .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.tool === tab));
		RENDER[tab]($("toolBody"));
	}
	document.querySelectorAll(".tools-tabs .seg-btn").forEach((b) => b.addEventListener("click", () => {
		tab = b.dataset.tool;
		try {
			localStorage.setItem(TAB_KEY, tab);
		} catch {}
		render();
	}));
	// live clocks
	setInterval(() => {
		if (tab === "timer" && tstate.running) {
			const ms = tleft();
			if ($("tmShow")) $("tmShow").textContent = hms(ms);
			if (ms <= 0) { tstate = { running: false, remaining: 0, total: 0, endAt: 0 }; render(); }
		}
		if (tab === "watch" && sw.running && $("swShow")) $("swShow").textContent = swText(swNow());
	}, 100);

	chrome.storage.local.get(TIMER).then((r) => {
		if (r[TIMER]) tstate = r[TIMER];
		if (tstate.running && tstate.endAt <= Date.now()) tstate = { running: false, remaining: 0, total: 0, endAt: 0 };
		render();
	});
	chrome.storage.onChanged.addListener((ch, area) => {
		if (area === "local" && ch[TIMER]) {
			tstate = ch[TIMER].newValue || tstate;
			if (tab === "timer") render();
		}
	});
	let sig = "";
	H.onRefresh(() => {
		const s = JSON.stringify([I18n.lang, setting("calendar"), setting("birthday", "")]);
		if (s === sig) return;
		sig = s;
		render();
	});
	window.Tools = { toDate };
})();
