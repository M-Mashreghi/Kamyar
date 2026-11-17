/* Month calendar for the Persian, Gregorian and Islamic calendars (pick the main one in Settings).
 * Every day also shows its date in the second calendar; the info line shows all three.
 * Dates come from the browser's built-in calendars (Intl); nothing is downloaded.
 * Lunar holidays use the Umm al-Qura calendar and may differ by a day from Iran's official announcement. */
(function () {
	"use strict";
	const { $, el, num, setting } = H;
	const DAY = 86400000;
	const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
	const addDays = (d, n) => noon(new Date(d.getTime() + n * DAY));
	const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	const fmtCache = {};
	function parts(cal, d) {
		const f = (fmtCache[cal] ||= new Intl.DateTimeFormat(`en-US-u-ca-${cal}-nu-latn`, { year: "numeric", month: "numeric", day: "numeric" }));
		const o = {};
		for (const p of f.formatToParts(d)) if (p.type !== "literal" && p.type !== "era") o[p.type === "relatedYear" ? "year" : p.type] = parseInt(p.value, 10);
		return o;
	}

	/** Returns [{emoji, name, off, kind}] for a day, following the Iran / world occasion settings. */
	function occasions(d) {
		return Occasions.forDay(d, { iran: setting("iranHolidays", true), world: setting("worldDays", true), cats: setting("occCats", {}) || {} });
	}

	let mainCal = null;
	let shown = null;
	let selected = null;
	const firstOf = (d) => {
		let x = noon(d);
		while (parts(mainCal, x).day !== 1) x = addDays(x, -1);
		return x;
	};

	function weekendDays() {
		return setting("iranHolidays", true) ? [5] : [0, 6];
	}
	function weekStart() {
		const w = setting("weekStart", "");
		if (w !== "" && w != null) return Number(w);
		return setting("iranHolidays", true) ? 6 : 1; // Saturday or Monday
	}

	async function render() {
		const cal = H.calOrder()[0];
		if (cal !== mainCal) {
			mainCal = cal;
			shown = firstOf(new Date());
		}
		const second = H.calOrder()[1];
		const today = noon(new Date());
		const monthFmt = new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${mainCal}`, { month: "long", year: "numeric" });
		const secondFmt = new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${second}`, { month: "short" });
		const smallNum = new Intl.NumberFormat(I18n.locale);
		if (I18n.lang === "fa") {
			const p = {};
			for (const x of monthFmt.formatToParts(shown)) p[x.type] = x.value;
			$("calTitle").textContent = `${p.month} ${p.year || p.relatedYear || ""}`.trim();
		} else $("calTitle").textContent = monthFmt.format(shown);

		const wdFmt = new Intl.DateTimeFormat(I18n.locale, { weekday: "narrow" });
		const ws = weekStart();
		const weekend = weekendDays();
		const cells = [];
		for (let i = 0; i < 7; i++) {
			const dow = (ws + i) % 7;
			const ref = new Date(2024, 0, 7 + dow); // 2024-01-07 is a Sunday
			cells.push(el("span", { class: "cal-wd" + (weekend.includes(dow) ? " off" : "") }, wdFmt.format(ref)));
		}
		const lead = (shown.getDay() - ws + 7) % 7;
		for (let i = 0; i < lead; i++) cells.push(el("span", { class: "cal-blank" }));
		const month = parts(mainCal, shown).month;
		const days = [];
		for (let d = shown; parts(mainCal, d).month === month; d = addDays(d, 1)) days.push(d);
		for (const d of days) {
			const p = parts(mainCal, d);
			const occ = occasions(d);
			const sp = parts(second, d);
			const cls = ["cal-day"];
			if (weekend.includes(d.getDay()) || occ.some((o) => o.off)) cls.push("off");
			if (occ.length) cls.push("has-occ");
			if (key(d) === key(today)) cls.push("today");
			if (selected && key(d) === key(selected)) cls.push("sel");
			cells.push(
				el(
					"button",
					{ type: "button", class: cls.join(" "), "data-day": key(d), title: occ.map((o) => o.emoji + " " + o.name).join("\n") || null, onclick: () => { selected = d; render(); } },
					el("span", {}, smallNum.format(p.day)),
					el("small", {}, sp.day === 1 ? secondFmt.format(d) : smallNum.format(sp.day)),
					el("i", { class: "ev-dot" }),
					occ.length ? el("b", { class: "occ-emoji", "aria-hidden": "true" }, occ[0].emoji) : null
				)
			);
		}
		$("calGrid").replaceChildren(...cells);

		const info = selected || today;
		const occ = occasions(info);
		$("calInfo").replaceChildren(
			el("span", { class: "cal-info-main" }, H.calOrder().map((c, i) => H.fmtDate(info, c, i === 0)).join(" · ")),
			...occ.map((o) => el("span", { class: "occ " + o.kind + (o.off ? " off" : "") }, o.emoji + " " + o.name))
		);

		// Day agenda: personal events and birthdays, tasks due, and Google Calendar events.
		const from = days[0], to = addDays(days[days.length - 1], 1);
		let gByDay = {}, gFail = false;
		if (window.GCal && (await GCal.isOn())) {
			const list = await GCal.events(from, to).catch(() => null);
			if (!list) gFail = true;
			else for (const ev of list) for (const k of ev.days) (gByDay[k] ||= []).push(ev);
		}
		const tasks = Store.list("todo").filter((x) => !x.done && x.due);
		const taskDays = new Set(tasks.map((x) => x.due));
		document.querySelectorAll("#calGrid .cal-day").forEach((b) => {
			const d = noon(new Date(b.dataset.day + "T12:00"));
			b.classList.toggle("has-ev", !!gByDay[b.dataset.day] || taskDays.has(b.dataset.day) || Events.forDay(d).length > 0);
		});
		const k = key(info);
		const mine = Events.forDay(info);
		const dayTasks = tasks.filter((x) => x.due === k).sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
		const gl = gByDay[k] || [];
		const rows = [
			...mine.map((m) => el("li", {}, el("span", { class: "ev-time" }, m.time || (m.ev.kind === "birthday" ? "🎂" : t("allDay"))), el("button", { type: "button", class: "ev-link", dir: m.ev.kind === "birthday" ? null : "auto", onclick: () => Events.openEditor(m.ev) }, el("i", { class: "ev-c", style: `background:${m.color}` }), m.title))),
			...dayTasks.map((x) => el("li", {}, el("span", { class: "ev-time" }, x.time || "☐"), el("button", { type: "button", class: "ev-link", dir: "auto", onclick: () => Todos.openEditor(x) }, el("i", { class: "ev-c task" }), x.text))),
			...gl.map((ev) => el("li", {}, el("span", { class: "ev-time" }, ev.allDay ? t("allDay") : ev.timeText), el("a", { href: ev.link, target: "_blank", rel: "noopener", dir: "auto" }, el("i", { class: "ev-c", style: `background:${ev.color || "var(--accent)"}` }), ev.title))),
		];
		$("calEvents").replaceChildren(
			el("div", { class: "ev-head" },
				el("strong", { class: "small" }, t("eventsOf", { date: H.fmtDate(info, mainCal, false) })),
				el("span", { class: "grow" }),
				el("button", { type: "button", class: "link-btn", onclick: () => Events.openEditor(null, key(info), "birthday") }, t("addBirthday")),
				el("button", { type: "button", class: "link-btn", onclick: () => Events.openEditor(null, key(info)) }, t("addEvent"))
			),
			rows.length ? el("ul", { class: "ev-list" }, ...rows) : el("p", { class: "muted small" }, t("noEvents")),
			...(gFail ? [el("p", { class: "error small" }, t("gcalFail"))] : [])
		);
	}

	$("calPrev").addEventListener("click", () => {
		shown = firstOf(addDays(shown, -1));
		render();
	});
	$("calNext").addEventListener("click", () => {
		shown = firstOf(addDays(shown, 32));
		render();
	});
	$("calTitle").addEventListener("click", () => {
		shown = firstOf(new Date());
		selected = null;
		render();
	});
	let lastDay = new Date().toDateString();
	setInterval(() => {
		if (new Date().toDateString() !== lastDay) {
			lastDay = new Date().toDateString();
			shown = firstOf(new Date());
			render();
		}
	}, 60000);

	// Re-render only when something that affects the calendar changed.
	let sig = "";
	H.onRefresh(() => {
		const s = JSON.stringify([I18n.lang, setting("calendar"), setting("iranHolidays", true), setting("worldDays", true), setting("occCats", {}), setting("weekStart", ""), H.widgetOn("calendar"), Store.list("event"), Store.list("todo").filter((x) => x.due && !x.done).map((x) => [x.id, x.text, x.due, x.time])]);
		if (s === sig) return;
		sig = s;
		render();
	});
	window.Cal = { render, occasions, parts, shown: () => shown, weekStart, weekendDays };
})();
