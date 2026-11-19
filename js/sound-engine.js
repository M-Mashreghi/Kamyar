/* Rubi focus sounds: every sound is synthesized live with the Web Audio API (no recordings, no downloads).
 * SoundEngine.create(ctx) returns { set(mix, master), tick(), stop() }.
 * mix is { soundId: volume 0..1 }. Event-based sounds (rain drops, cup clinks, crickets…) are scheduled by tick(). */
(function (g) {
	"use strict";
	const R = Math.random;
	const between = (a, b) => a + R() * (b - a);

	function noiseBuffer(ctx, kind) {
		ctx._kmNoise ||= {};
		if (ctx._kmNoise[kind]) return ctx._kmNoise[kind];
		const sr = ctx.sampleRate, len = sr * 8, fade = Math.floor(sr * 0.25);
		const buf = ctx.createBuffer(2, len, sr);
		for (let ch = 0; ch < 2; ch++) {
			const d = buf.getChannelData(ch);
			let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
			for (let i = 0; i < len; i++) {
				const w = R() * 2 - 1;
				if (kind === "white") d[i] = w * 0.5;
				else if (kind === "pink") {
					b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
					b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
					d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
					b6 = w * 0.115926;
				} else {
					last = (last + 0.02 * w) / 1.02;
					d[i] = last * 3.5;
				}
			}
			// Cross-fade the end into the start so the loop has no click.
			for (let i = 0; i < fade; i++) {
				const k = i / fade;
				d[i] = d[i] * k + d[len - fade + i] * (1 - k);
			}
		}
		return (ctx._kmNoise[kind] = buf);
	}

	function make(ctx, out) {
		const nodes = [];
		const keep = (n) => (nodes.push(n), n);
		const api = {
			noise(kind) {
				const s = keep(ctx.createBufferSource());
				s.buffer = noiseBuffer(ctx, kind);
				s.loop = true;
				s.loopEnd = s.buffer.duration - 0.25;
				s.start(ctx.currentTime, R() * 6);
				return s;
			},
			filter(type, freq, q = 0.7) {
				const f = ctx.createBiquadFilter();
				f.type = type;
				f.frequency.value = freq;
				f.Q.value = q;
				return f;
			},
			gain(v) {
				const gn = ctx.createGain();
				gn.gain.value = v;
				return gn;
			},
			pan(v) {
				if (!ctx.createStereoPanner) return api.gain(1);
				const p = ctx.createStereoPanner();
				p.pan.value = v;
				return p;
			},
			// A slow sine that moves an AudioParam around its current value.
			lfo(param, rate, depth, offset) {
				const o = keep(ctx.createOscillator());
				o.frequency.value = rate;
				const d = ctx.createGain();
				d.gain.value = depth;
				o.connect(d).connect(param);
				if (offset != null) param.value = offset;
				o.start(ctx.currentTime + R() * 0.1);
				return o;
			},
			chain(...n) {
				for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
				return n[n.length - 1];
			},
			// One short burst of filtered noise (a rain drop, a crackle).
			burst(t, { kind = "white", type = "bandpass", freq = 3000, q = 4, dur = 0.03, amp = 0.1, attack = 0.002, pan = 0 }) {
				const s = ctx.createBufferSource();
				s.buffer = noiseBuffer(ctx, kind);
				const f = api.filter(type, freq, q), e = ctx.createGain(), p = api.pan(pan);
				e.gain.setValueAtTime(0, t);
				e.gain.linearRampToValueAtTime(amp, t + attack);
				e.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
				api.chain(s, f, e, p, out);
				s.start(t, R() * 6, attack + dur + 0.05);
			},
			// A sine "ping" or chirp with a pitch sweep.
			tone(t, { freqs, dur = 0.1, amp = 0.05, attack = 0.005, pan = 0, type = "sine" }) {
				const o = ctx.createOscillator(), e = ctx.createGain(), p = api.pan(pan);
				o.type = type;
				o.frequency.setValueAtTime(freqs[0], t);
				freqs.slice(1).forEach((f, i) => o.frequency.exponentialRampToValueAtTime(f, t + (dur * (i + 1)) / (freqs.length - 1 || 1)));
				e.gain.setValueAtTime(0, t);
				e.gain.linearRampToValueAtTime(amp, t + attack);
				e.gain.exponentialRampToValueAtTime(0.0001, t + attack + dur);
				api.chain(o, e, p, out);
				o.start(t);
				o.stop(t + attack + dur + 0.05);
			},
			stop() {
				for (const n of nodes) {
					try { n.stop(); } catch {}
					try { n.disconnect(); } catch {}
				}
			}
		};
		return api;
	}

	// Poisson-style scheduler: calls fire(t) about `rate` times per second between t0 and t1.
	function every(state, key, rate, t0, t1, fire) {
		let t = Math.max(state[key] || t0, t0);
		while (t < t1) {
			fire(t);
			t += -Math.log(1 - R()) / rate;
		}
		state[key] = t;
	}

	const SOUNDS = {
		rain(ctx, out, a) {
			a.chain(a.noise("pink"), a.filter("highpass", 400), a.filter("lowpass", 6500), a.gain(0.55), out);
			const hiss = a.chain(a.noise("white"), a.filter("bandpass", 2600, 0.5), a.gain(0.1), out);
			a.lfo(hiss.gain, 0.05, 0.04, 0.1);
			const st = {};
			return (t0, t1) => every(st, "d", 22, t0, t1, (t) => a.burst(t, { freq: between(1800, 6500), q: between(3, 10), dur: between(0.01, 0.04), amp: between(0.03, 0.16), pan: between(-0.9, 0.9) }));
		},
		storm(ctx, out, a) {
			a.chain(a.noise("pink"), a.filter("highpass", 300), a.filter("lowpass", 5000), a.gain(0.6), out);
			a.chain(a.noise("brown"), a.filter("lowpass", 500), a.gain(0.5), out);
			const st = {};
			return (t0, t1) => {
				every(st, "d", 30, t0, t1, (t) => a.burst(t, { freq: between(1500, 5000), q: 4, dur: between(0.01, 0.05), amp: between(0.04, 0.14), pan: between(-1, 1) }));
				every(st, "th", 1 / 22, t0, t1, (t) => {
					const len = between(3, 7);
					a.burst(t, { kind: "brown", type: "lowpass", freq: between(120, 260), q: 0.7, attack: between(0.08, 0.5), dur: len, amp: between(0.6, 1.2), pan: between(-0.5, 0.5) });
					a.burst(t, { kind: "brown", type: "lowpass", freq: 900, q: 0.5, attack: 0.02, dur: 0.6, amp: between(0.15, 0.4), pan: between(-0.5, 0.5) });
				});
			};
		},
		wind(ctx, out, a) {
			const f1 = a.filter("bandpass", 450, 0.9), g1 = a.gain(0.5);
			a.chain(a.noise("pink"), f1, g1, a.pan(-0.4), out);
			a.lfo(f1.frequency, 0.045, 260, 450);
			a.lfo(g1.gain, 0.07, 0.3, 0.5);
			const f2 = a.filter("bandpass", 800, 1.4), g2 = a.gain(0.3);
			a.chain(a.noise("pink"), f2, g2, a.pan(0.4), out);
			a.lfo(f2.frequency, 0.031, 380, 800);
			a.lfo(g2.gain, 0.053, 0.2, 0.3);
		},
		waves(ctx, out, a) {
			const body = a.gain(0.5), foam = a.gain(0.05);
			a.chain(a.noise("brown"), a.filter("lowpass", 900), body, out);
			a.chain(a.noise("white"), a.filter("highpass", 2200), foam, out);
			a.lfo(body.gain, 0.085, 0.45, 0.5);
			a.lfo(foam.gain, 0.085, 0.05, 0.05);
			const body2 = a.gain(0.3);
			a.chain(a.noise("brown"), a.filter("lowpass", 600), body2, a.pan(0.6), out);
			a.lfo(body2.gain, 0.061, 0.3, 0.3);
		},
		stream(ctx, out, a) {
			const f = a.filter("bandpass", 1500, 0.6), gn = a.gain(0.35);
			a.chain(a.noise("white"), f, gn, out);
			a.lfo(f.frequency, 0.3, 300, 1500);
			a.chain(a.noise("pink"), a.filter("lowpass", 700), a.gain(0.35), out);
			const st = {};
			return (t0, t1) => every(st, "b", 9, t0, t1, (t) => {
				const f0 = between(300, 900);
				a.tone(t, { freqs: [f0, f0 * between(1.6, 2.6)], dur: between(0.03, 0.08), amp: between(0.01, 0.04), pan: between(-0.8, 0.8) });
			});
		},
		fire(ctx, out, a) {
			const rumble = a.gain(0.6);
			a.chain(a.noise("brown"), a.filter("lowpass", 280), rumble, out);
			a.lfo(rumble.gain, 0.2, 0.15, 0.6);
			a.chain(a.noise("pink"), a.filter("bandpass", 900, 0.8), a.gain(0.04), out);
			const st = {};
			return (t0, t1) => {
				every(st, "c", 10, t0, t1, (t) => a.burst(t, { type: "highpass", freq: between(1200, 3500), q: 0.7, attack: 0.001, dur: between(0.003, 0.02), amp: between(0.05, 0.3), pan: between(-0.6, 0.6) }));
				every(st, "p", 0.4, t0, t1, (t) => a.burst(t, { type: "bandpass", freq: between(500, 1500), q: 1, attack: 0.001, dur: between(0.03, 0.08), amp: between(0.3, 0.6), pan: between(-0.5, 0.5) }));
			};
		},
		cafe(ctx, out, a) {
			a.chain(a.noise("brown"), a.filter("lowpass", 220), a.gain(0.25), out);
			// A few murmuring "voices": band-limited noise whose loudness moves at a speech-like rhythm.
			for (let i = 0; i < 5; i++) {
				const f = a.filter("bandpass", between(350, 900), 1.6), gn = a.gain(0.0);
				a.chain(a.noise("pink"), f, gn, a.pan(between(-0.8, 0.8)), out);
				a.lfo(gn.gain, between(2.5, 5.5), 0.05, 0.07);
				a.lfo(gn.gain, between(0.08, 0.25), 0.06, null);
				a.lfo(f.frequency, between(0.5, 1.5), 120, null);
			}
			const st = {};
			return (t0, t1) => {
				every(st, "k", 0.35, t0, t1, (t) => {
					const base = between(2200, 3600), pan = between(-0.8, 0.8), amp = between(0.015, 0.04);
					a.tone(t, { freqs: [base, base], dur: between(0.25, 0.6), amp, pan, attack: 0.001 });
					a.tone(t, { freqs: [base * 2.71, base * 2.71], dur: 0.2, amp: amp * 0.5, pan, attack: 0.001 });
					if (R() < 0.4) a.tone(t + between(0.08, 0.2), { freqs: [base * 1.12, base * 1.12], dur: 0.3, amp: amp * 0.7, pan, attack: 0.001 });
				});
				every(st, "s", 0.25, t0, t1, (t) => a.burst(t, { type: "bandpass", freq: between(800, 2500), q: 2, attack: 0.002, dur: between(0.05, 0.15), amp: between(0.02, 0.05), pan: between(-0.8, 0.8) }));
			};
		},
		night(ctx, out, a) {
			a.chain(a.noise("pink"), a.filter("lowpass", 450), a.gain(0.2), out);
			const st = {};
			const crickets = [[4200, -0.6], [4650, 0.5], [3900, 0.1]];
			return (t0, t1) => {
				crickets.forEach(([f, pan], i) =>
					every(st, "c" + i, 1.4, t0, t1, (t) => {
						const pulses = 3 + Math.floor(R() * 3);
						for (let k = 0; k < pulses; k++) a.tone(t + k * 0.035, { freqs: [f, f * 1.01], dur: 0.018, amp: 0.025, attack: 0.003, pan });
					})
				);
				every(st, "o", 0.08, t0, t1, (t) => {
					a.tone(t, { freqs: [520, 470], dur: 0.35, amp: 0.03, attack: 0.05, pan: between(-0.7, 0.7) });
					a.tone(t + 0.55, { freqs: [520, 440], dur: 0.6, amp: 0.025, attack: 0.05, pan: between(-0.7, 0.7) });
				});
			};
		},
		birds(ctx, out, a) {
			const leaves = a.gain(0.12);
			a.chain(a.noise("pink"), a.filter("bandpass", 1800, 0.5), leaves, out);
			a.lfo(leaves.gain, 0.09, 0.07, 0.12);
			const st = {};
			return (t0, t1) =>
				every(st, "b", 0.7, t0, t1, (t) => {
					const pan = between(-0.9, 0.9), base = between(2400, 4200), n = 1 + Math.floor(R() * 5), kind = Math.floor(R() * 3);
					for (let k = 0; k < n; k++) {
						const s = t + k * between(0.09, 0.16);
						if (kind === 0) a.tone(s, { freqs: [base, base * 1.5, base * 0.9], dur: 0.08, amp: 0.035, pan });
						else if (kind === 1) a.tone(s, { freqs: [base * 1.3, base * 0.8], dur: 0.06, amp: 0.03, pan });
						else a.tone(s, { freqs: [base * 0.8, base * 1.1, base * 1.05], dur: 0.12, amp: 0.03, pan });
					}
				});
		},
		train(ctx, out, a) {
			const body = a.gain(0.45);
			a.chain(a.noise("brown"), a.filter("lowpass", 350), body, out);
			a.lfo(body.gain, 0.03, 0.1, 0.45);
			a.chain(a.noise("pink"), a.filter("bandpass", 1200, 0.8), a.gain(0.05), out);
			const st = {};
			return (t0, t1) => {
				// The clack of wheels over rail joints: two pairs of thumps, about every 1.6 s.
				let t = Math.max(st.n || t0, t0);
				while (t < t1) {
					for (const dt of [0, 0.14, 0.62, 0.76]) a.burst(t + dt, { kind: "brown", type: "lowpass", freq: 260, q: 1, attack: 0.002, dur: 0.12, amp: 0.55, pan: 0 });
					t += 1.6;
				}
				st.n = t;
			};
		},
		white(ctx, out, a) {
			a.chain(a.noise("white"), a.gain(0.35), out);
		},
		pink(ctx, out, a) {
			a.chain(a.noise("pink"), a.gain(0.6), out);
		},
		brown(ctx, out, a) {
			a.chain(a.noise("brown"), a.filter("lowpass", 1200), a.gain(0.6), out);
		},
		// Alpha binaural beat: 200 Hz in the left ear, 210 Hz in the right. Needs headphones.
		binaural(ctx, out, a) {
			const merge = ctx.createChannelMerger(2);
			for (const [f, ch] of [[200, 0], [210, 1]]) {
				const o = ctx.createOscillator();
				o.frequency.value = f;
				const gn = a.gain(0.18);
				o.connect(gn).connect(merge, 0, ch);
				o.start();
				(a._extra ||= []).push(o);
			}
			merge.connect(out);
		}
	};

	// Some sounds are made of short, sparse events and need more gain to sit at the same loudness.
	const BOOST = { birds: 3, night: 2.2, cafe: 1.6, stream: 1.3, wind: 1.3, rain: 1.2 };

	function create(ctx) {
		const comp = ctx.createDynamicsCompressor();
		comp.threshold.value = -14;
		comp.ratio.value = 4;
		const master = ctx.createGain();
		master.gain.value = 0.8;
		const makeup = ctx.createGain();
		makeup.gain.value = 2.2;
		master.connect(makeup).connect(comp).connect(ctx.destination);
		const live = {};
		let ahead = 0;
		function start(id) {
			const out = ctx.createGain();
			out.gain.value = 0;
			out.connect(master);
			const a = make(ctx, out);
			const tick = SOUNDS[id](ctx, out, a) || null;
			live[id] = { out, a, tick, from: ctx.currentTime };
		}
		function stopOne(id) {
			const x = live[id];
			if (!x) return;
			delete live[id];
			x.out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
			setTimeout(() => {
				x.a.stop();
				(x.a._extra || []).forEach((o) => { try { o.stop(); } catch {} });
				try { x.out.disconnect(); } catch {}
			}, 1500);
		}
		return {
			ids: Object.keys(SOUNDS),
			set(mix, vol) {
				master.gain.setTargetAtTime(Math.max(0, Math.min(1, vol ?? 0.8)), ctx.currentTime, 0.15);
				for (const id of Object.keys(SOUNDS)) {
					const v = Number((mix || {})[id] || 0);
					if (v > 0) {
						if (!live[id]) start(id);
						live[id].out.gain.setTargetAtTime(Math.pow(v, 1.6) * (BOOST[id] || 1), ctx.currentTime, 0.3);
					} else stopOne(id);
				}
			},
			// Schedule events for the next window; call a few times a second.
			tick(window = 0.6) {
				const now = ctx.currentTime;
				ahead = Math.max(ahead, now);
				const until = now + window;
				for (const x of Object.values(live)) if (x.tick) x.tick(Math.max(ahead, x.from), until);
				ahead = until;
			},
			stop() {
				Object.keys(live).forEach(stopOne);
			}
		};
	}
	g.SoundEngine = { create, ids: Object.keys(SOUNDS) };
})(typeof self !== "undefined" ? self : window);
