/* Personal events and birthdays: which days an event falls on, and when its reminder fires.
 * Shared by the new-tab page and the background service worker, so it must not touch the DOM.
 * Repeats can follow the Persian, Gregorian or Islamic calendar (a Persian birthday stays on the same Persian date). */
(function (g) {
	"use strict";
	const DAY = 86400000;
	const pad = (n) => String(n).padStart(2, "0");
	const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const noonOf = (s) => new Date(s + "T12:00:00");
	const fmt = {};
	function parts(cal, d) {
		if (cal === "gregory") return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
		const f = (fmt[cal] ||= new Intl.DateTimeFormat(`en-US-u-ca-${cal}-nu-latn`, { year: "numeric", month: "numeric", day: "numeric" }));
		const o = {};
		for (const p of f.formatToParts(d)) if (p.type !== "literal" && p.type !== "era") o[p.type === "relatedYear" ? "year" : p.type] = parseInt(p.value, 10);
		return o;
	}
	// True when d is the last day of its month in that calendar.
	const lastOfMonth = (cal, d) => parts(cal, new Date(d.getTime() + DAY)).month !== parts(cal, d).month;

	/** Does the event happen on day d (a Date at noon)? */
	function matches(ev, d) {
		if (!ev || !ev.date) return false;
		const dk = dstr(d);
		if (dk < ev.date) return false;
		if (ev.until && dk > ev.until) return false;
		const r = ev.repeat || "";
		if (!r) return dk === ev.date;
		const start = noonOf(ev.date);
		if (r === "daily") return true;
		if (r === "weekdays") {
			const wd = d.getDay();
			return ev.cal === "persian" ? wd !== 5 : wd !== 0 && wd !== 6;
		}
		if (r === "weekly") return d.getDay() === start.getDay();
		const cal = ev.cal || "gregory";
		const a = parts(cal, start), b = parts(cal, d);
		// A date that doesn't exist this month or year (31st, 30 Esfand, 29 Feb) falls on the month's last day.
		const dayOk = b.day === a.day || (b.day < a.day && lastOfMonth(cal, d));
		if (r === "monthly") return dayOk;
		if (r === "yearly") return b.month === a.month && dayOk;
		return false;
	}

	/** Reminder time for the occurrence on day d, or null when the event has no reminder. */
	function remindTime(ev, d) {
		if (ev.remind == null || ev.remind === "" || ev.remind < 0) return null;
		const time = !ev.allDay && ev.start ? ev.start : "09:00";
		const at = new Date(`${dstr(d)}T${time}:00`).getTime();
		return at - Number(ev.remind) * 60000;
	}

	/** Next reminder time after `after` (ms), looking up to 400 days ahead. */
	function nextFire(ev, after = Date.now()) {
		if (remindTime(ev, new Date()) == null) return null;
		const base = new Date();
		base.setHours(12, 0, 0, 0);
		for (let i = -7; i < 400; i++) {
			const d = new Date(base.getTime() + i * DAY);
			d.setHours(12, 0, 0, 0);
			if (!matches(ev, d)) continue;
			const t = remindTime(ev, d);
			if (t > after) return { when: t, day: dstr(d) };
		}
		return null;
	}

	/** Age (whole years) on day d for a birthday with a known year. */
	function ageOn(ev, d) {
		if (!ev.year) return null;
		const cal = ev.cal || "gregory";
		return parts(cal, d).year - parts(cal, noonOf(ev.date)).year;
	}

	g.EvCore = { parts, matches, remindTime, nextFire, ageOn, dstr, noonOf, DAY };
})(typeof self !== "undefined" ? self : window);
