/* Personal events and birthdays: editor, day agenda data, and reminder alarms.
 * Repeat rules and reminder times live in events-core.js, which the background worker shares. */
(function () {
	"use strict";
	const { $, el, num } = H;
	const E = window.EvCore;
	const COLORS = Todos.COLORS;
	const REMIND_EVENT = [["", "rmNone"], [0, "rmAt"], [5, "rm5"], [15, "rm15"], [30, "rm30"], [60, "rm60"], [1440, "rm1d"], [10080, "rm1w"]];
	const REMIND_BDAY = [["", "rmNone"], [0, "rmDay"], [1440, "rm1d"], [10080, "rm1w"]];

	const events = () => Store.list("event");
	const colorOf = (c) => COLORS[c] || c || COLORS.blue;

	/** Everything personal on a day: [{ev, time, title, color, age}] sorted by time. */
	function forDay(d) {
		const out = [];
		for (const ev of events()) {
			if (!E.matches(ev, d)) continue;
			const age = ev.kind === "birthday" ? E.ageOn(ev, d) : null;
			const name = "\u2068" + ev.title + "\u2069"; // keeps a Persian name intact inside an English sentence
			const title = ev.kind === "birthday" ? (age != null && age > 0 ? t("bdayTitleAge", { name, n: num(age) }) : t("bdayTitle", { name })) : ev.title;
			out.push({ ev, title, color: colorOf(ev.color), time: ev.kind === "birthday" || ev.allDay || !ev.start ? "" : ev.start + (ev.end ? "–" + ev.end : "") });
		}
		return out.sort((a, b) => (a.time || "00").localeCompare(b.time || "00"));
	}

	/* ---------- editor ---------- */
	let editing = null;
	let kind = "event";
	let color = "blue";
	const defaultCal = () => (I18n.lang === "fa" ? "persian" : "gregory");

	function renderKind() {
		document.querySelectorAll("#eventDialog .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.kind === kind));
		const bday = kind === "birthday";
		$("evTitle").placeholder = t(bday ? "bdayName" : "eventTitlePh");
		$("evDateLabel").textContent = t(bday ? "birthDate" : "date");
		document.querySelectorAll("#eventDialog .ev-noyear").forEach((n) => (n.hidden = !bday));
		document.querySelectorAll("#eventDialog .ev-allday, #eventDialog .ev-repeat").forEach((n) => (n.hidden = bday));
		const timed = !bday && !$("evAllDay").checked;
		document.querySelectorAll("#eventDialog .ev-time").forEach((n) => (n.hidden = !timed));
		const rep = bday ? "yearly" : $("evRepeat").value;
		document.querySelectorAll("#eventDialog .ev-cal").forEach((n) => (n.hidden = !(rep === "monthly" || rep === "yearly")));
		const cur = $("evRemind").value;
		$("evRemind").replaceChildren(...(bday ? REMIND_BDAY : REMIND_EVENT).map(([v, k]) => el("option", { value: String(v) }, t(k))));
		if ([...$("evRemind").options].some((o) => o.value === cur)) $("evRemind").value = cur;
		renderHint();
	}
	function renderHint() {
		const v = $("evDate").value;
		if (!v) return ($("evDateHint").textContent = "");
		const d = E.noonOf(v);
		$("evDateHint").textContent = H.calOrder().map((c) => H.fmtDate(d, c, false)).join(" · ");
	}
	function renderColors() {
		$("evColors").replaceChildren(
			...Object.entries(COLORS).map(([k, c]) => el("button", { type: "button", class: "sw" + (k === color ? " on" : ""), style: `background:${c}`, title: t("c_" + k), "aria-label": t("c_" + k), onclick: () => { color = k; renderColors(); } }))
		);
	}

	function openEditor(ev, dateStr, presetKind, preset) {
		editing = ev || null;
		const v = ev || { ...preset, kind: presetKind || "event", date: dateStr || E.dstr(new Date()), allDay: false, start: "", end: "", repeat: "", cal: defaultCal(), remind: presetKind === "birthday" ? 0 : 15, color: presetKind === "birthday" ? "pink" : "blue", ...(preset || {}) };
		kind = v.kind || "event";
		color = v.color || "blue";
		$("eventDialogTitle").textContent = t(ev ? "editEvent" : "newEvent");
		$("evTitle").value = v.title || "";
		$("evDate").value = v.date || "";
		$("evNoYear").checked = v.kind === "birthday" && !v.year;
		$("evAllDay").checked = !!v.allDay;
		$("evStart").value = v.start || "";
		$("evEnd").value = v.end || "";
		$("evRepeat").value = v.repeat || "";
		$("evCal").value = v.cal || defaultCal();
		$("evDesc").value = v.desc || "";
		$("evDelete").hidden = !ev;
		$("evRemind").replaceChildren();
		renderKind();
		$("evRemind").value = v.remind == null || v.remind === "" ? "" : String(v.remind);
		renderColors();
		$("eventDialog").showModal();
		$("evTitle").focus();
	}
	document.querySelectorAll("#eventDialog .seg-btn").forEach((b) => b.addEventListener("click", () => {
		kind = b.dataset.kind;
		if (kind === "birthday" && color === "blue") color = "pink";
		renderKind();
		renderColors();
	}));
	["evAllDay", "evRepeat"].forEach((id) => $(id).addEventListener("change", renderKind));
	$("evDate").addEventListener("input", renderHint);
	$("eventForm").addEventListener("submit", (e) => {
		if (e.submitter && e.submitter.value !== "save") return;
		const title = $("evTitle").value.trim();
		const date = $("evDate").value;
		if (!title || !date) return e.preventDefault();
		const bday = kind === "birthday";
		const rv = $("evRemind").value;
		const fields = {
			kind, title, date, color,
			desc: $("evDesc").value.trim(),
			allDay: bday || $("evAllDay").checked,
			start: bday || $("evAllDay").checked ? "" : $("evStart").value,
			end: bday || $("evAllDay").checked ? "" : $("evEnd").value,
			repeat: bday ? "yearly" : $("evRepeat").value,
			cal: $("evCal").value,
			remind: rv === "" ? "" : Number(rv),
			year: bday ? !$("evNoYear").checked : undefined,
		};
		if (editing) Store.update(editing.id, fields);
		else Store.add("event", fields);
	});
	$("evDelete").addEventListener("click", () => {
		const ev = editing;
		if (!ev) return;
		$("eventDialog").close();
		const snap = { ...ev };
		delete snap.id;
		Store.remove(ev.id);
		H.toast(t("eventDeleted"), { run: () => Store.add("event", snap) });
	});

	/* ---------- reminders ---------- */
	let timer = null;
	function syncAlarms() {
		clearTimeout(timer);
		timer = setTimeout(async () => {
			const want = new Map();
			for (const ev of events()) {
				const n = E.nextFire(ev);
				if (n) want.set("ev:" + ev.id, n.when);
			}
			for (const a of await chrome.alarms.getAll()) if (a.name.startsWith("ev:") && (!want.has(a.name) || Math.abs(want.get(a.name) - a.scheduledTime) > 1000)) await chrome.alarms.clear(a.name);
			const have = new Set((await chrome.alarms.getAll()).map((a) => a.name));
			for (const [name, when] of want) if (!have.has(name)) chrome.alarms.create(name, { when });
		}, 600);
	}
	H.onRefresh(syncAlarms);

	window.Events = { forDay, openEditor, colorOf };
})();
