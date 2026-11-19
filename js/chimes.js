/* Rubi welcome chimes: short, gentle sounds made on the fly with Web Audio (no audio files),
 * used when a Rubi tab opens. Shared by the new-tab page and the offscreen document. */
(function (root) {
	"use strict";
	// One soft "pluck" or bell partial: a sine (or triangle) with a quick attack and a long fade.
	function tone(ctx, out, { f, t = 0, d = 1.2, v = 0.3, type = "sine", attack = 0.008, detune = 0, partials = [] }) {
		const at = ctx.currentTime + t;
		const g = ctx.createGain();
		g.gain.setValueAtTime(0.0001, at);
		g.gain.exponentialRampToValueAtTime(v, at + attack);
		g.gain.exponentialRampToValueAtTime(0.0001, at + d);
		g.connect(out);
		for (const [mul, amp] of [[1, 1], ...partials]) {
			const o = ctx.createOscillator(), og = ctx.createGain();
			o.type = type;
			o.frequency.value = f * mul;
			o.detune.value = detune;
			og.gain.value = amp;
			o.connect(og).connect(g);
			o.start(at);
			o.stop(at + d + 0.05);
		}
	}
	// A little room around the sound.
	function space(ctx, dest, wet = 0.25) {
		const input = ctx.createGain(), dry = ctx.createGain(), w = ctx.createGain();
		dry.gain.value = 1;
		w.gain.value = wet;
		input.connect(dry).connect(dest);
		[0.11, 0.19, 0.29].forEach((dt, i) => {
			const dl = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
			dl.delayTime.value = dt;
			fb.gain.value = 0.35 - i * 0.07;
			lp.type = "lowpass";
			lp.frequency.value = 3200;
			input.connect(dl).connect(lp).connect(fb).connect(dl);
			lp.connect(w);
		});
		w.connect(dest);
		return input;
	}
	const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note → Hz
	const BELL = [[2.76, 0.35], [5.4, 0.12], [8.93, 0.05]];
	const LIST = {
		// Crystal: a rising bell arpeggio.
		crystal: (c, o) => [76, 79, 83, 88].forEach((n, i) => tone(c, o, { f: N(n), t: i * 0.09, d: 1.6, v: 0.16, partials: BELL })),
		// Morning: warm marimba-like notes going up.
		morning: (c, o) => [67, 71, 74, 79].forEach((n, i) => tone(c, o, { f: N(n), t: i * 0.13, d: 0.9, v: 0.22, partials: [[4, 0.25], [10, 0.05]] })),
		// Harp: a soft glissando.
		harp: (c, o) => [60, 64, 67, 71, 72, 76, 79, 83].forEach((n, i) => tone(c, o, { f: N(n), t: i * 0.055, d: 1.8, v: 0.1, type: "triangle", partials: [[2, 0.3], [3, 0.1]] })),
		// Zen bowl: one long, slowly beating bowl.
		bowl: (c, o) => { tone(c, o, { f: N(69), d: 4, v: 0.18, attack: 0.02, partials: [[2.71, 0.4], [5.1, 0.15]] }); tone(c, o, { f: N(69), d: 4, v: 0.1, attack: 0.02, detune: 7 }); },
		// Kalimba: a short, happy thumb-piano phrase.
		kalimba: (c, o) => [[72, 0], [76, 0.14], [79, 0.28], [84, 0.5]].forEach(([n, t]) => tone(c, o, { f: N(n), t, d: 1.1, v: 0.2, partials: [[5.9, 0.18], [3, 0.08]] })),
		// Dewdrop: two light drops of water.
		drop: (c, o) => [[88, 0], [95, 0.16]].forEach(([n, t]) => { const at = c.currentTime + t, os = c.createOscillator(), g = c.createGain(); os.frequency.setValueAtTime(N(n) * 0.6, at); os.frequency.exponentialRampToValueAtTime(N(n), at + 0.08); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5); os.connect(g).connect(o); os.start(at); os.stop(at + 0.6); }),
		// Breeze: a soft major chord that swells and fades.
		breeze: (c, o) => [60, 64, 67, 71, 76].forEach((n, i) => tone(c, o, { f: N(n), t: i * 0.03, d: 2.6, v: 0.07, attack: 0.5, type: "triangle" }))
	};
	function play(ctx, id, volume = 0.6) {
		const fn = LIST[id] || LIST.crystal;
		const master = ctx.createGain();
		master.gain.value = Math.max(0, Math.min(1, volume));
		master.connect(ctx.destination);
		fn(ctx, space(ctx, master));
	}
	root.Chimes = { ids: Object.keys(LIST), play };
})(typeof self !== "undefined" ? self : window);
