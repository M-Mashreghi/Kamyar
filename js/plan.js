/* Planner: a week view with hours (events, birthdays, tasks with a due date, Google Calendar),
 * next to the tasks / notes panel. Click an empty hour to add an event there. */
(function () {
	"use strict";
	const { $, el, num, setting } = H;
	const DAY = 86400000;
	const HOUR = 48; // px per hour
	const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
	const addDays = (d, n) => noon(new Date(d.getTime() + n * DAY));
	const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	const mins = (hhmm) => (hhmm ? +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5) : null);
	const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

	function weekStart() {
		const w = setting("weekStart", "");
		if (w !== "" && w != null) return Number(w);
		return setting("iranHolidays", true) ? 6 : 1;
	}
	const startOfWeek = (d) => addDays(noon(d), -((noon(d).getDay() - weekStart() + 7) % 7));
	let start = startOfWeek(new Date());

	// Side-by-side columns for overlapping blocks in one day.
	function layout(blocks) {
		blocks.sort((a, b) => a.s - b.s || b.e - a.e);
		let group = [], groupEnd = -1;
		const flush = () => {
			const cols = [];
			for (const b of group) {
				let c = cols.findIndex((end) => end <= b.s);
				if (c < 0) c = cols.push(0) - 1;
				cols[c] = b.e;
				b.col = c;
			}
			group.forEach((b) => (b.cols = cols.length));
			group = [];
		};
		for (const b of blocks) {
			if (b.s >= groupEnd) flush(), (groupEnd = -1);
			group.push(b);
			groupEnd = Math.max(groupEnd, b.e);
		}
		flush();
		return blocks;
	}

	let gcal = {};
	async function loadGcal(from, to) {
		gcal = {};
		if (!window.GCal || !(await GCal.isOn())) return;
		const list = await GCal.events(from, to).catch(() => []);
		for (const ev of list) for (const k of ev.days) (gcal[k] ||= []).push(ev);
	}

	async function render() {
		if ($("viewPlan").hidden) return;
		const cal = H.calOrder()[0];
		const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
		const dm = new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${cal}`, { day: "numeric", month: "long" });
		const wd = new Intl.DateTimeFormat(I18n.locale, { weekday: "long" });
		$("weekTitle").textContent = `${dm.format(days[0])} – ${dm.format(days[6])}`;
		const today = key(new Date());
		const occ = (d) => Occasions.forDay(d, { iran: setting("iranHolidays", true), world: setting("worldDays", true), cats: setting("occCats", {}) || {} });
		$("weekHead").replaceChildren(el("span", { class: "wk-gutter" }), ...days.map((d) => {
			const o = occ(d);
			const off = (setting("iranHolidays", true) ? d.getDay() === 5 : d.getDay() === 0 || d.getDay() === 6) || o.some((x) => x.off);
			return el("div", { class: "wk-day" + (key(d) === today ? " today" : "") + (off ? " off" : ""), title: o.map((x) => x.emoji + " " + x.name).join("\n") || null },
				el("strong", {}, wd.format(d)), el("small", {}, dm.format(d), o.length ? " " + o.map((x) => x.emoji).join("") : ""));
		}));
		await loadGcal(days[0], addDays(days[6], 1));
		const tasks = Store.list("todo").filter((x) => x.due && (!x.done || setting("planShowDone", false)));
		const allRow = [el("span", { class: "wk-gutter small muted" }, t("allDay"))];
		const cols = [];
		const nowM = new Date().getHours() * 60 + new Date().getMinutes();
		for (const d of days) {
			const k = key(d);
			const all = [], timed = [];
			for (const m of Events.forDay(d)) {
				const s = mins(m.ev.start);
				if (m.ev.kind === "birthday" || m.ev.allDay || s == null) all.push({ title: (m.ev.kind === "birthday" ? "🎂 " : "") + m.title, bday: m.ev.kind === "birthday", color: m.color, open: () => Events.openEditor(m.ev) });
				else timed.push({ s, e: Math.max(s + 20, mins(m.ev.end) || s + 60), title: m.title, sub: m.time, color: m.color, open: () => Events.openEditor(m.ev) });
			}
			for (const x of tasks.filter((x) => x.due === k)) {
				const s = mins(x.time);
				const item = { title: (x.done ? "✓ " : "☐ ") + x.text, color: "var(--accent)", task: true, done: x.done, open: () => Todos.openEditor(x) };
				if (s == null) all.push(item);
				else timed.push({ ...item, s, e: s + 30, sub: x.time });
			}
			for (const g of gcal[k] || []) {
				const item = { title: g.title, color: g.color || "var(--accent)", link: g.link };
				if (g.allDay) all.push(item);
				else {
					const s = g.start.getHours() * 60 + g.start.getMinutes();
					const sameDay = key(g.start) === k;
					const e = g.end && key(g.end) === k ? g.end.getHours() * 60 + g.end.getMinutes() : 24 * 60;
					timed.push({ ...item, s: sameDay ? s : 0, e: Math.max((sameDay ? s : 0) + 20, e), sub: g.timeText });
				}
			}
			const chip = (it, cls, style) => {
				const attrs = { class: cls + (it.task ? " task" : "") + (it.done ? " done" : ""), style, title: it.title, dir: it.bday ? null : "auto" };
				return it.link ? el("a", { ...attrs, href: it.link, target: "_blank", rel: "noopener" }, el("span", {}, it.title)) : el("button", { ...attrs, type: "button", onclick: (e) => { e.stopPropagation(); it.open(); } }, el("span", {}, it.title), it.sub ? el("small", { dir: "ltr" }, it.sub) : null);
			};
			allRow.push(el("div", { class: "wk-allcell" }, ...all.map((it) => chip(it, "wk-chip", `--c:${it.color}`))));
			const col = el("div", { class: "wk-col" + (k === today ? " today" : ""), onclick: (e) => {
				if (e.target !== col) return;
				const m = Math.floor(e.offsetY / HOUR) * 60;
				Events.openEditor(null, k, null, { allDay: false, start: hhmm(m), end: hhmm(Math.min(m + 60, 23 * 60 + 59)) });
			} });
			for (const b of layout(timed))
				col.append(chip(b, "wk-ev" + (b.e - b.s < 45 ? " short" : ""), `--c:${b.color};top:${(b.s / 60) * HOUR}px;height:${Math.max(18, ((b.e - b.s) / 60) * HOUR - 2)}px;inset-inline-start:calc(${(b.col / b.cols) * 100}% + 2px);width:calc(${100 / b.cols}% - 4px)`));
			if (k === today) col.append(el("i", { class: "wk-now", style: `top:${(nowM / 60) * HOUR}px` }));
			cols.push(col);
		}
		$("weekAll").replaceChildren(...allRow);
		const hours = el("div", { class: "wk-hours" }, ...Array.from({ length: 24 }, (_, h) => el("span", { style: `top:${h * HOUR}px` }, h ? new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, h)) : "")));
		$("weekGrid").replaceChildren(hours, ...cols);
		$("weekGrid").style.height = 24 * HOUR + "px";
	}
	function scrollToNow() {
		const h = new Date().getHours();
		$("weekScroll").scrollTop = Math.max(0, (h - 2) * HOUR);
	}

	$("weekPrev").addEventListener("click", () => { start = addDays(start, -7); render(); });
	$("weekNext").addEventListener("click", () => { start = addDays(start, 7); render(); });
	$("planToday").addEventListener("click", () => { start = startOfWeek(new Date()); render().then(scrollToNow); });
	$("planNew").addEventListener("click", () => Events.openEditor(null));
	$("planNotes").addEventListener("click", () => H.showSide && H.showSide("note"));

	let sig = "";
	H.onRefresh(() => {
		const s = JSON.stringify([I18n.lang, setting("calendar"), setting("weekStart", ""), setting("iranHolidays", true), setting("worldDays", true), setting("occCats", {}), Store.list("event"), Store.list("todo").filter((x) => x.due).map((x) => [x.id, x.text, x.due, x.time, x.done])]);
		if (s === sig) return;
		sig = s;
		render();
	});
	setInterval(() => !$("viewPlan").hidden && document.visibilityState === "visible" && render(), 60000);
	window.Plan = { show: () => { start = startOfWeek(new Date()); render().then(scrollToNow); } };
})();
