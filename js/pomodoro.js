/* Pomodoro timer. State lives in chrome.storage.local so every open tab shows the same timer;
 * the background service worker ends the session and shows a notification even if no tab is open. */
(function () {
	"use strict";
	const { $ } = H;
	const KEY = "hamyar_pomo";
	const MIN = 60000;
	const DUR = { focus: 25 * MIN, short: 5 * MIN, long: 15 * MIN };
	let state = { mode: "focus", running: false, endAt: 0, remaining: DUR.focus, count: 0, countDate: "" };

	const today = () => new Date().toDateString();
	const left = () => (state.running ? Math.max(0, state.endAt - Date.now()) : state.remaining);

	function render() {
		const ms = left();
		const total = Math.ceil(ms / 1000);
		const two = new Intl.NumberFormat(I18n.locale, { minimumIntegerDigits: 2, useGrouping: false });
		const text = `${two.format(Math.floor(total / 60))}:${two.format(total % 60)}`;
		$("pomoTime").textContent = text;
		$("pomoStart").textContent = t(state.running ? "pause" : ms < DUR[state.mode] ? "resume" : "start");
		document.querySelectorAll(".pomo-mode").forEach((b) => {
			b.classList.toggle("active", b.dataset.mode === state.mode);
			b.setAttribute("aria-selected", String(b.dataset.mode === state.mode));
		});
		const c = state.countDate === today() ? state.count : 0;
		$("pomoCount").textContent = c ? t("todaySessions", { n: new Intl.NumberFormat(I18n.locale).format(c) }) : "";
		document.title = state.running ? `${text} · ${t(state.mode === "focus" ? "pFocus" : "pBreak")}` : t("newTab");
	}

	async function update(next) {
		state = { ...state, ...next };
		await chrome.storage.local.set({ [KEY]: state });
		if (state.running) chrome.alarms.create("hamyar-pomo", { when: state.endAt });
		else chrome.alarms.clear("hamyar-pomo");
		render();
	}

	$("pomoStart").addEventListener("click", () => {
		if (state.running) update({ running: false, remaining: left() });
		else update({ running: true, endAt: Date.now() + (state.remaining || DUR[state.mode]) });
	});
	$("pomoReset").addEventListener("click", () => update({ running: false, remaining: DUR[state.mode] }));
	document.querySelectorAll(".pomo-mode").forEach((b) => b.addEventListener("click", () => update({ mode: b.dataset.mode, running: false, remaining: DUR[b.dataset.mode] })));

	chrome.storage.onChanged.addListener((ch, area) => {
		if (area === "local" && ch[KEY] && ch[KEY].newValue) {
			state = { ...state, ...ch[KEY].newValue };
			render();
		}
	});
	H.onRefresh(render);
	chrome.storage.local.get(KEY).then((r) => {
		if (r[KEY]) state = { ...state, ...r[KEY] };
		render();
		setInterval(() => H.widgetOn("pomodoro") && render(), 500);
	});
})();
