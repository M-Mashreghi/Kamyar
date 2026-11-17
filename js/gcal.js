/* Google Calendar: read-only list of the person's events, shown in the month calendar.
 * Uses its own read-only scope; events are fetched straight from Google and never stored in Drive. */
(function () {
	"use strict";
	const { $ } = H;
	const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
	const API = "https://www.googleapis.com/calendar/v3";
	const KEY = "hamyar_gcal";
	const cache = new Map();
	const TTL = 10 * 60 * 1000;

	async function token(interactive) {
		const r = await chrome.identity.getAuthToken({ interactive, scopes: [SCOPE] });
		const tok = typeof r === "string" ? r : r && r.token;
		if (!tok) throw new Error("no-token");
		return tok;
	}
	async function get(url, retried = false) {
		const tok = await token(false);
		const res = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
		if (res.status === 401 && !retried) {
			await chrome.identity.removeCachedAuthToken({ token: tok });
			return get(url, true);
		}
		if (!res.ok) throw new Error("Calendar " + res.status);
		return res.json();
	}
	const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

	function expand(ev, calColor) {
		const allDay = !!(ev.start && ev.start.date);
		const start = allDay ? new Date(ev.start.date + "T12:00") : new Date(ev.start.dateTime);
		let end = allDay ? new Date(ev.end.date + "T12:00") : new Date(ev.end.dateTime);
		if (allDay) end = new Date(end.getTime() - 86400000); // end date is exclusive
		const days = [];
		for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12); d <= end || days.length === 0; d = new Date(d.getTime() + 86400000)) {
			days.push(dayKey(d));
			if (days.length > 62) break;
		}
		const tf = new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit" });
		return { title: ev.summary || "(—)", link: ev.htmlLink, allDay, start, end: allDay ? null : end, days, timeText: allDay ? "" : tf.format(start), color: calColor };
	}

	const GCal = {
		async isOn() {
			return !!(await chrome.storage.local.get(KEY))[KEY];
		},
		async events(from, to) {
			const k = from.toISOString() + to.toISOString();
			const hit = cache.get(k);
			if (hit && Date.now() - hit.at < TTL) return hit.list;
			const cals = await get(`${API}/users/me/calendarList?minAccessRole=reader&fields=items(id,selected,backgroundColor)`);
			const chosen = (cals.items || []).filter((c) => c.selected !== false).slice(0, 15);
			const q = `timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}&singleEvents=true&orderBy=startTime&maxResults=250&fields=items(summary,htmlLink,start,end,status)`;
			const lists = await Promise.all(chosen.map((c) => get(`${API}/calendars/${encodeURIComponent(c.id)}/events?${q}`).then((r) => (r.items || []).filter((e) => e.status !== "cancelled").map((e) => expand(e, c.backgroundColor))).catch(() => [])));
			const list = lists.flat().sort((a, b) => a.start - b.start);
			cache.set(k, { at: Date.now(), list });
			return list;
		},
		async renderSettings() {
			const on = await GCal.isOn();
			$("gcalInfo").textContent = t(on ? "gcalOn" : "gcalOff");
			$("gcalBtn").textContent = on ? t("disconnect") : t("connectGcal");
		}
	};

	$("gcalBtn").addEventListener("click", async () => {
		const btn = $("gcalBtn");
		btn.disabled = true;
		try {
			if (await GCal.isOn()) {
				try {
					const tok = await token(false);
					await chrome.identity.removeCachedAuthToken({ token: tok });
				} catch {}
				await chrome.storage.local.set({ [KEY]: false });
			} else {
				await token(true);
				await chrome.storage.local.set({ [KEY]: true });
			}
			cache.clear();
			$("settingsMsg").textContent = "";
			Cal.render();
		} catch (e) {
			$("settingsMsg").textContent = H.oauthError(e);
		} finally {
			btn.disabled = false;
			GCal.renderSettings();
		}
	});

	window.GCal = GCal;
})();
