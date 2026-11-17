/* Focus sounds mixer. The mix lives in chrome.storage.local (kamyar_sounds); the service worker plays it
 * in an offscreen document, so it keeps going in other tabs and every Kamyar tab shows the same state. */
(function () {
	"use strict";
	const { $, el, num, toast } = H;
	const KEY = "kamyar_sounds";
	const LIST = [
		["rain", "🌧️"], ["storm", "⛈️"], ["wind", "🌬️"], ["waves", "🌊"], ["stream", "🏞️"], ["fire", "🔥"], ["cafe", "☕"],
		["night", "🌙"], ["birds", "🐦"], ["train", "🚆"], ["white", "⚪"], ["pink", "🌸"], ["brown", "🟤"], ["binaural", "🎧"]
	];
	const PRESETS = [
		["pRainCafe", "☕🌧️", { cafe: 0.6, rain: 0.5 }],
		["pFireside", "🔥🌧️", { fire: 0.7, rain: 0.35 }],
		["pDeep", "🧠", { brown: 0.6, binaural: 0.35 }],
		["pForest", "🌲", { birds: 0.55, stream: 0.5, wind: 0.2 }],
		["pOcean", "🏖️", { waves: 0.8, wind: 0.2 }],
		["pSummerNight", "🌙", { night: 0.7, stream: 0.25 }],
		["pStorm", "⛈️", { storm: 0.7, wind: 0.3 }],
		["pTrain", "🚆", { train: 0.6, rain: 0.35 }]
	];
	const TIMERS = [0, 15, 30, 45, 60, 90, 120];
	let state = { playing: false, master: 0.8, mix: {}, endAt: 0, auto: true };
	const hasLocal = () => !!globalThis.chrome?.storage?.local;
	const anyOn = (mix) => Object.values(mix || {}).some((v) => v > 0);

	// Without the extension APIs (a plain web page while testing) the page plays the mix itself.
	let localEng = null;
	function playHere() {
		if (hasLocal() && chrome.offscreen) return;
		if (!localEng) {
			const ctx = new AudioContext();
			localEng = SoundEngine.create(ctx);
			setInterval(() => localEng.tick(), 250);
		}
		localEng.set(state.playing ? state.mix : {}, state.master);
	}

	async function save(next, redraw = true) {
		state = { ...state, ...next };
		if (hasLocal()) await chrome.storage.local.set({ [KEY]: state });
		playHere();
		if (redraw) draw();
	}

	function draw() {
		const playing = state.playing && anyOn(state.mix);
		$("sndPlay").textContent = playing ? "⏸" : "▶";
		$("sndPlay").classList.toggle("on", playing);
		$("sndPlay").title = t(playing ? "sndPause" : "sndPlay");
		$("soundsBtn").classList.toggle("playing", playing);
		$("sndMaster").value = String(Math.round((state.master ?? 0.8) * 100));
		$("sndAuto").checked = state.auto !== false;
		const left = state.endAt ? Math.max(0, Math.round((state.endAt - Date.now()) / 60000)) : 0;
		$("sndTimer").replaceChildren(
			...TIMERS.map((m) => el("option", { value: String(m), selected: m === 0 ? !left : false }, m ? t("sndMinutes", { n: num(m) }) : t("sndNoTimer"))),
			...(left ? [el("option", { value: "cur", selected: true }, t("sndLeft", { n: num(left) }))] : [])
		);
		const cur = JSON.stringify(state.mix);
		$("sndPresets").replaceChildren(
			...PRESETS.map(([k, emoji, mix]) =>
				el("button", { type: "button", class: "chip snd-preset" + (cur === JSON.stringify(mix) ? " active" : ""), onclick: () => save({ mix: { ...mix }, playing: true }) }, emoji + " " + t(k)))
		);
		$("sndGrid").replaceChildren(
			...LIST.map(([id, emoji]) => {
				const v = Number(state.mix[id] || 0);
				return el("div", { class: "snd-tile" + (v > 0 ? " on" : "") },
					el("button", {
						type: "button",
						class: "snd-btn",
						"aria-pressed": String(v > 0),
						onclick: () => {
							const mix = { ...state.mix };
							if (v > 0) delete mix[id];
							else mix[id] = 0.5;
							save({ mix, playing: anyOn(mix) ? true : state.playing });
						}
					}, el("span", { class: "snd-emoji" }, emoji), el("span", { class: "snd-name" }, t("snd_" + id))),
					el("input", {
						type: "range", min: "5", max: "100", value: String(Math.round(v * 100 || 50)), class: "snd-vol", "aria-label": t("snd_" + id), disabled: v > 0 ? null : true,
						oninput: (e) => {
							state.mix = { ...state.mix, [id]: Number(e.target.value) / 100 };
							clearTimeout(volTimer);
							volTimer = setTimeout(() => save({}, false), 120);
						}
					}));
			})
		);
	}
	let volTimer = 0;

	$("sndPlay").addEventListener("click", () => {
		if (!anyOn(state.mix)) return save({ mix: { ...PRESETS[0][2] }, playing: true });
		save({ playing: !state.playing, byFocus: false, endAt: state.playing ? 0 : state.endAt });
	});
	$("sndMaster").addEventListener("input", (e) => {
		state.master = Number(e.target.value) / 100;
		clearTimeout(volTimer);
		volTimer = setTimeout(() => save({}, false), 120);
	});
	$("sndTimer").addEventListener("change", (e) => {
		if (e.target.value === "cur") return;
		const m = Number(e.target.value);
		save({ endAt: m ? Date.now() + m * 60000 : 0, playing: m ? true : state.playing });
		if (m) toast(t("sndTimerSet", { n: num(m) }));
	});
	$("sndAuto").addEventListener("change", (e) => save({ auto: e.target.checked }));
	// Rail button: play / pause; with nothing chosen yet, open the mixer on the tools page.
	$("soundsBtn").addEventListener("click", () => {
		if (!anyOn(state.mix)) {
			H.showView("tools");
			document.querySelector('[data-widget="sounds"]').scrollIntoView({ behavior: "smooth", block: "center" });
			return;
		}
		save({ playing: !state.playing, byFocus: false });
		toast(t(state.playing ? "sndOnToast" : "sndOffToast"));
	});

	// While focus mode is on, the mixer sits next to the Pomodoro timer.
	const panel = document.querySelector('[data-widget="sounds"]');
	const home = { parent: panel.parentNode, next: panel.nextSibling };
	new MutationObserver(() => {
		const on = !$("focusLayer").hidden;
		if (on && panel.parentNode !== $("focusSounds")) $("focusSounds").append(panel);
		else if (!on && panel.parentNode === $("focusSounds")) home.parent.insertBefore(panel, home.next);
	}).observe($("focusLayer"), { attributes: true, attributeFilter: ["hidden"] });

	if (hasLocal() && chrome.storage.onChanged)
		chrome.storage.onChanged.addListener((c, area) => {
			if (area === "local" && c[KEY] && c[KEY].newValue && JSON.stringify(c[KEY].newValue) !== JSON.stringify(state)) {
				state = { ...state, ...c[KEY].newValue };
				draw();
			}
		});
	H.onRefresh(draw);
	setInterval(() => state.endAt && draw(), 30000);
	(async () => {
		if (hasLocal()) {
			const s = (await chrome.storage.local.get(KEY))[KEY];
			if (s) state = { ...state, ...s };
		}
		draw();
	})();
	H.sounds = { get: () => state, save };
})();
