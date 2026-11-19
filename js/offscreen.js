/* Plays the focus-sound mix in the background, so it keeps going while you browse.
 * Offscreen documents only get chrome.runtime, so the service worker sends the mix here. */
(function () {
	"use strict";
	let ctx = null, eng = null, timer = 0;
	function apply(s) {
		const on = s && s.playing && Object.values(s.mix || {}).some((v) => v > 0);
		if (!on) {
			if (eng) eng.set({}, 0);
			return;
		}
		if (!ctx) {
			ctx = new AudioContext({ latencyHint: "playback" });
			eng = SoundEngine.create(ctx);
			timer = setInterval(() => eng.tick(), 250);
		}
		if (ctx.state === "suspended") ctx.resume();
		eng.set(s.mix, s.master);
		eng.tick();
	}
	// Welcome chime for a new Rubi tab when Chrome didn't let the tab itself make sound.
	function welcome(m) {
		if (m.data) {
			const a = new Audio(m.data);
			a.volume = m.vol;
			a.play().catch(() => {});
			return;
		}
		const c = new AudioContext();
		Chimes.play(c, m.id, m.vol);
		setTimeout(() => c.close(), 6000);
	}
	chrome.runtime.onMessage.addListener((m) => {
		if (m && m.target === "kamyar-offscreen" && m.type === "sounds") apply(m.state);
		if (m && m.target === "kamyar-offscreen" && m.type === "welcome") welcome(m);
	});
	chrome.runtime.sendMessage({ type: "kamyar-sounds-get" }).then(apply).catch(() => {});
	window.addEventListener("unload", () => clearInterval(timer));
})();
