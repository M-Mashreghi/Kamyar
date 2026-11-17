importScripts("i18n-bg.js", "events-core.js");

// Clicking the toolbar icon opens a new tab (the Kamyar page).
chrome.action.onClicked.addListener(() => chrome.tabs.create({}));

// Pomodoro: finish the session when its alarm fires, even if no new tab is open.
const POMO = "hamyar_pomo";
const MIN = 60000;
const DUR = { focus: 25 * MIN, short: 5 * MIN, long: 15 * MIN };

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== "hamyar-pomo") return;
	const s = (await chrome.storage.local.get(POMO))[POMO];
	if (!s || !s.running) return;
	const today = new Date().toDateString();
	let count = s.countDate === today ? s.count || 0 : 0;
	let next;
	if (s.mode === "focus") {
		count += 1;
		next = count % 4 === 0 ? "long" : "short";
	} else next = "focus";
	await chrome.storage.local.set({ [POMO]: { ...s, running: false, mode: next, remaining: DUR[next], count, countDate: today } });
	const t = await bgT();
	const title = s.mode === "focus" ? t("notifFocusDone") : t("notifBreakDone");
	const message = s.mode === "focus" ? t("notifBreakNext", { m: next === "long" ? 15 : 5 }) : t("notifFocusNext");
	chrome.notifications.create("hamyar-pomo-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title, message, priority: 2 });
});

// Task reminders: the new-tab page schedules an alarm "todo:<id>" for each task with a reminder.
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (!alarm.name.startsWith("todo:")) return;
	const id = alarm.name.slice(5);
	const data = (await chrome.storage.local.get("hamyar_data")).hamyar_data;
	const x = data && data.items && data.items[id];
	if (!x || x.deleted || x.done) return;
	const t = await bgT();
	chrome.notifications.create("hamyar-todo-" + id + "-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title: t("notifTask"), message: String(x.text || "").slice(0, 200) + (x.desc ? "\n" + String(x.desc).slice(0, 200) : ""), priority: 2 });
});
// Personal events and birthdays: notify, then schedule the next occurrence of a repeating event.
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (!alarm.name.startsWith("ev:")) return;
	const id = alarm.name.slice(3);
	const data = (await chrome.storage.local.get("hamyar_data")).hamyar_data;
	const ev = data && data.items && data.items[id];
	if (!ev || ev.deleted) return;
	const t = await bgT();
	const days = Math.round(Number(ev.remind || 0) / 1440);
	const when = days <= 0 ? t("whenToday") : days === 1 ? t("whenTomorrow") : t("whenInDays", { n: days });
	const occ = new Date(Date.now() + Number(ev.remind || 0) * 60000);
	occ.setHours(12, 0, 0, 0);
	let title, message;
	if (ev.kind === "birthday") {
		const age = EvCore.ageOn(ev, occ);
		title = age > 0 ? t("notifBirthdayAge", { name: ev.title, n: age }) : t("notifBirthday", { name: ev.title });
		message = when;
	} else {
		title = t("notifEvent");
		message = String(ev.title || "").slice(0, 200) + "\n" + when + (ev.start && !ev.allDay ? " · " + ev.start : "");
	}
	chrome.notifications.create("hamyar-ev-" + id + "-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title, message, priority: 2 });
	const next = EvCore.nextFire(ev, Date.now() + 60000);
	if (next) chrome.alarms.create(alarm.name, { when: next.when });
});
// Countdown timer from the tools widget.
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== "hamyar-timer") return;
	await chrome.storage.local.set({ hamyar_timer: { running: false, remaining: 0, total: 0, endAt: 0 } });
	const t = await bgT();
	chrome.notifications.create("hamyar-timer-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title: t("notifTimer"), message: t("notifTimerMsg"), priority: 2, requireInteraction: true });
});
chrome.notifications.onClicked.addListener((nid) => {
	if (nid.startsWith("hamyar-")) chrome.tabs.create({});
});
