/* Prayer-time reminder (off by default, turned on in Settings › Calendar): while the time for the
 * morning, noon & afternoon, or evening & night prayer is open, a card at the page edge counts down how
 * long is left to pray. Times come from the on-device calculation in prayer.js for the weather city. */
(function () {
	"use strict";
	const { $, el, num, setting } = H;
	const DEF = { on: false, fajr: true, asr: true, isha: true, before: 30 };
	const cfg = () => ({ ...DEF, ...(setting("salat", {}) || {}) });
	const save = (patch) => Store.setSetting("salat", { ...cfg(), ...patch });
	const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
	// Each window: when it opens and when it ends (keys of Prayer.compute), and the label of its end.
	const WIN = [
		{ k: "fajr", from: "fajr", to: "sunrise", title: "salatFajrT", end: "sunrise" },
		{ k: "asr", from: "dhuhr", to: "sunset", title: "salatAsrT", end: "sunset" },
		{ k: "isha", from: "maghrib", to: "midnight", title: "salatIshaT", end: "midnight" }
	];

	/** The open prayer window right now, or null: { w, left (hours), endAt (city hours), day }. */
	function current() {
		const city = setting("city");
		if (!city || !window.Prayer) return null;
		const now = Prayer.nowInCity(city.tz);
		const today = Prayer.compute(now.date, city.lat, city.lon, now.off);
		const y = new Date(now.date.getTime() - 86400000);
		const yest = Prayer.compute(y, city.lat, city.lon, now.off);
		const c = cfg();
		const day = now.date.toISOString().slice(0, 10);
		for (const w of WIN) {
			if (!c[w.k]) continue;
			let from = today[w.from], to = today[w.to], d = day;
			// After midnight (local), the evening window may still be yesterday's.
			if (w.k === "isha" && now.hours < today.fajr) { from = yest[w.from] - 24; to = yest[w.to] - 24; d = y.toISOString().slice(0, 10); }
			if (!isFinite(from) || !isFinite(to)) continue;
			if (now.hours >= from && now.hours < to) return { w, left: to - now.hours, endAt: to, day: d };
		}
		return null;
	}
	const clock = (h) => {
		const s = Math.max(0, Math.round(h * 3600));
		const two = (n) => num(String(n).padStart(2, "0"));
		return num(Math.floor(s / 3600)) + ":" + two(Math.floor((s % 3600) / 60)) + ":" + two(s % 60);
	};

	let card = null, shownKey = "";
	function close(remember) {
		if (!card) return;
		if (remember) ls("kamyar_salat_closed", shownKey);
		const c = card;
		card = null;
		c.classList.add("out");
		setTimeout(() => c.remove(), 250);
	}
	function tick() {
		const c = cfg();
		const cur = c.on ? current() : null;
		const key = cur ? cur.w.k + "@" + cur.day : "";
		const due = cur && (!+c.before || cur.left * 60 <= +c.before);
		if (!due || ls("kamyar_salat_closed") === key) return close(false);
		if (card && shownKey !== key) close(false);
		if (!card) {
			shownKey = key;
			card = el("div", { class: "care-card salat", role: "status" },
				el("span", { class: "care-ic" }, "🕌"),
				el("div", { class: "care-body" },
					el("strong", {}, t(cur.w.title)),
					el("p", { class: "salat-left" }, el("span", {}, t("salatLeft") + " "), el("b", { class: "salat-clock" })),
					el("small", { class: "muted salat-end" })),
				el("button", { type: "button", class: "care-x", title: t("close"), "aria-label": t("close"), onclick: () => close(true) }, "✕"));
			$("careStack").append(card);
			requestAnimationFrame(() => card && card.classList.add("in"));
		}
		card.querySelector("strong").textContent = t(cur.w.title);
		card.querySelector(".salat-left span").textContent = t("salatLeft") + " ";
		card.querySelector(".salat-clock").textContent = clock(cur.left);
		card.querySelector(".salat-end").textContent = t("salatEnds", { what: t(cur.w.end), at: Prayer.hm(cur.endAt) });
		card.classList.toggle("urgent", cur.left * 60 <= 15);
	}
	H.salatNow = current;

	/* ---------- settings ---------- */
	function drawSettings() {
		const c = cfg();
		$("salatChk").checked = c.on;
		$("salatOpts").hidden = !c.on;
		$("salatFajr").checked = c.fajr;
		$("salatAsr").checked = c.asr;
		$("salatIsha").checked = c.isha;
		$("salatBefore").value = String(c.before);
	}
	$("salatChk").addEventListener("change", (e) => {
		save({ on: e.target.checked });
		if (e.target.checked && !setting("city")) H.toast(t("salatNeedCity"));
	});
	$("salatFajr").addEventListener("change", (e) => save({ fajr: e.target.checked }));
	$("salatAsr").addEventListener("change", (e) => save({ asr: e.target.checked }));
	$("salatIsha").addEventListener("change", (e) => save({ isha: e.target.checked }));
	$("salatBefore").addEventListener("change", (e) => save({ before: Number(e.target.value) }));

	H.onRefresh(() => { drawSettings(); tick(); });
	setInterval(() => document.visibilityState === "visible" && tick(), 1000);
})();
