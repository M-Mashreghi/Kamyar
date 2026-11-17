/* Prayer times, calculated on the device (no network) for the city chosen in the weather widget.
 * Method: Institute of Geophysics, University of Tehran (Fajr 17.7°, Isha 14°, Maghrib 4.5°,
 * midnight = halfway between sunset and Fajr). Astronomy follows the public PrayTimes.org formulas. */
(function () {
	"use strict";
	const { $, el, setting } = H;
	const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
	const sin = (d) => Math.sin(rad(d)), cos = (d) => Math.cos(rad(d)), tan = (d) => Math.tan(rad(d));
	const asin = (x) => deg(Math.asin(x)), acos = (x) => deg(Math.acos(x)), atan2 = (y, x) => deg(Math.atan2(y, x));
	const fix = (a, b) => ((a % b) + b) % b;

	function julian(y, m, d) {
		if (m <= 2) { y -= 1; m += 12; }
		const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
		return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
	}
	function sun(jd) {
		const D = jd - 2451545.0;
		const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
		const L = fix(q + 1.915 * sin(g) + 0.02 * sin(2 * g), 360);
		const e = 23.439 - 0.00000036 * D;
		const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
		return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
	}

	/** Prayer times in local hours (0–24) of the given UTC offset. */
	function compute(date, lat, lng, offsetHours) {
		const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
		const midDay = (t) => fix(12 - sun(jd + t).eqt, 24);
		const angleTime = (angle, t, ccw) => {
			const { decl } = sun(jd + t);
			const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
			if (x < -1 || x > 1) return NaN; // polar day/night
			const tt = acos(x) / 15;
			return midDay(t) + (ccw ? -tt : tt);
		};
		const r = {
			fajr: angleTime(17.7, 5 / 24, true),
			sunrise: angleTime(0.833, 6 / 24, true),
			dhuhr: midDay(12 / 24),
			sunset: angleTime(0.833, 18 / 24),
			maghrib: angleTime(4.5, 18 / 24),
			isha: angleTime(14, 18 / 24)
		};
		for (const k in r) r[k] += offsetHours - lng / 15;
		r.midnight = r.sunset + fix(r.fajr + 24 - r.sunset, 24) / 2;
		return r;
	}

	function tzOffset(tz, date) {
		if (!tz) return -date.getTimezoneOffset() / 60;
		try {
			const p = {};
			for (const x of new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(date)) p[x.type] = +x.value;
			return (Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute) - Math.floor(date.getTime() / 60000) * 60000) / 3600000;
		} catch {
			return -date.getTimezoneOffset() / 60;
		}
	}
	function nowInCity(tz) {
		const d = new Date();
		const off = tzOffset(tz, d);
		const utcH = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
		return { hours: fix(utcH + off, 24), off, date: new Date(d.getTime() + (off * 3600000 + d.getTimezoneOffset() * 60000)) };
	}

	const ORDER = ["fajr", "sunrise", "dhuhr", "sunset", "maghrib", "isha", "midnight"];
	function hm(h) {
		if (!isFinite(h)) return "—";
		let m = Math.round(fix(h, 24) * 60);
		const f = new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
		return f.format(Date.UTC(2000, 0, 1, Math.floor(m / 60) % 24, m % 60));
	}

	function render() {
		if (!H.widgetOn("prayer")) return;
		const city = setting("city");
		if (!city) {
			$("prayerCity").textContent = "";
			$("prayerBody").replaceChildren(el("p", { class: "muted" }, t("enterCity")));
			return;
		}
		const now = nowInCity(city.tz);
		const times = compute(now.date, city.lat, city.lon, now.off);
		$("prayerCity").textContent = city.name;
		let next = ORDER.find((k) => k !== "midnight" && isFinite(times[k]) && times[k] > now.hours);
		let nextAt = next ? times[next] : times.fajr + 24;
		if (!next) next = "fajr";
		const left = Math.max(0, Math.round((nextAt - now.hours) * 60));
		const leftTxt = new Intl.NumberFormat(I18n.locale, { minimumIntegerDigits: 1 }).format(Math.floor(left / 60)) + ":" + new Intl.NumberFormat(I18n.locale, { minimumIntegerDigits: 2 }).format(left % 60);
		$("prayerBody").replaceChildren(
			el("ul", { class: "prayer-list" }, ...ORDER.map((k) => el("li", { class: k === next ? "next" : "" }, el("span", {}, t(k)), el("strong", {}, hm(times[k]))))),
			el("p", { class: "muted small prayer-next" }, t("nextPrayer", { name: t(next), left: leftTxt })),
			el("p", { class: "muted small" }, t("prayerMethod"))
		);
	}

	H.onRefresh(render);
	setInterval(() => document.visibilityState === "visible" && render(), 30000);
	window.Prayer = { compute, tzOffset };
})();
