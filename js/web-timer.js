/* Kamyar web focus: a small floating timer on every site while a focus session runs.
 * It follows the Pomodoro state (hamyar_pomo) and shows only while kamyar_webtimer.on is true.
 * Drag it anywhere; its place is remembered for all sites. Runs in a closed shadow root so pages can't restyle it. */
(() => {
	if (window.__kamyarWebTimer) return;
	window.__kamyarWebTimer = true;
	const POMO = "hamyar_pomo", WT = "kamyar_webtimer", POS = "kamyar_webtimer_pos";
	const S = {
		fa: { focus: "تمرکز", brk: "استراحت", pause: "توقف", resume: "ادامه", stop: "پایان جلسه", done: "جلسه‌ی تمرکز تمام شد 🎉", paused: "متوقف", drag: "بکشید تا جابه‌جا شود", min: "کوچک/بزرگ" },
		en: { focus: "Focus", brk: "Break", pause: "Pause", resume: "Resume", stop: "End session", done: "Focus session done 🎉", paused: "Paused", drag: "Drag to move", min: "Compact" },
		fr: { focus: "Concentration", brk: "Pause", pause: "Pause", resume: "Reprendre", stop: "Terminer", done: "Session terminée 🎉", paused: "En pause", drag: "Glisser pour déplacer", min: "Compact" },
		de: { focus: "Fokus", brk: "Pause", pause: "Pause", resume: "Weiter", stop: "Beenden", done: "Fokus-Sitzung fertig 🎉", paused: "Pausiert", drag: "Zum Verschieben ziehen", min: "Kompakt" }
	};
	let pomo = null, wt = null, pos = null, lang = "fa", tick = 0, doneUntil = 0;
	const host = document.createElement("div");
	host.style.cssText = "all:initial;position:fixed;z-index:2147483646;top:0;left:0;";
	const root = host.attachShadow({ mode: "closed" });
	root.innerHTML = `<style>
		.w{font:600 13px/1.2 Vazirmatn,Tahoma,system-ui,sans-serif;color:#fff;background:rgba(20,24,36,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
		border:1px solid rgba(255,255,255,.14);border-radius:999px;box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;align-items:center;gap:6px;padding:5px 6px 5px 10px;
		cursor:grab;user-select:none;touch-action:none;direction:ltr;transition:opacity .2s}
		.w.drag{cursor:grabbing;opacity:.85}.w.brk{background:rgba(18,90,70,.88)}.w.p{opacity:.75}
		.ring{width:22px;height:22px;flex:none}.ring circle{fill:none;stroke-width:3}.bg{stroke:rgba(255,255,255,.2)}.fg{stroke:#7aa2ff;stroke-linecap:round;transform:rotate(-90deg);transform-origin:50% 50%}
		.w.brk .fg{stroke:#5fe0b0}.t{font-variant-numeric:tabular-nums;font-size:15px;letter-spacing:.3px;min-width:44px;text-align:center}
		.l{font-weight:500;font-size:11.5px;opacity:.75}
		button{all:unset;cursor:pointer;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:12px;background:rgba(255,255,255,.12)}
		button:hover{background:rgba(255,255,255,.26)}button:focus-visible{outline:2px solid #7aa2ff}
		.w.c .l,.w.c .b2{display:none}
		.msg{padding:4px 8px}
	</style><div class="w" part="w"><svg class="ring" viewBox="0 0 24 24"><circle class="bg" cx="12" cy="12" r="9"/><circle class="fg" cx="12" cy="12" r="9"/></svg>
	<span class="t">--:--</span><span class="l"></span><button class="b1" type="button"></button><button class="b2" type="button">■</button></div>`;
	const w = root.querySelector(".w"), tEl = root.querySelector(".t"), lEl = root.querySelector(".l"), fg = root.querySelector(".fg"), b1 = root.querySelector(".b1"), b2 = root.querySelector(".b2");
	const C = 2 * Math.PI * 9;
	fg.style.strokeDasharray = C;
	const DUR = { focus: 25 * 60000, short: 5 * 60000, long: 15 * 60000 };
	const s = (k) => (S[lang] || S.en)[k];
	const send = (op) => chrome.runtime.sendMessage({ kamyar: "pomo", op }).catch?.(() => {});
	b1.addEventListener("click", (e) => { e.stopPropagation(); send("toggle"); });
	b2.addEventListener("click", (e) => { e.stopPropagation(); send("stop"); });
	w.addEventListener("dblclick", () => { w.classList.toggle("c"); save(); });

	function place() {
		const r = w.getBoundingClientRect();
		const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
		const p = pos || { x: 1, y: 1 };
		const x = Math.round(Math.min(Math.max(8, p.x * (vw - r.width - 16) + 8), vw - r.width - 8));
		const y = Math.round(Math.min(Math.max(8, p.y * (vh - r.height - 16) + 8), vh - r.height - 8));
		host.style.transform = `translate(${x}px, ${y}px)`;
	}
	function save() { chrome.storage.local.set({ [POS]: { ...(pos || { x: 1, y: 1 }), c: w.classList.contains("c") } }); }
	// Dragging: the position is kept as a fraction of the window, so it lands in the same corner on any screen.
	let drag = null;
	w.addEventListener("pointerdown", (e) => {
		if (e.target.closest("button")) return;
		const m = /translate\((-?\d+)px, (-?\d+)px\)/.exec(host.style.transform) || [0, 0, 0];
		drag = { dx: e.clientX - m[1], dy: e.clientY - m[2], moved: false };
		w.setPointerCapture(e.pointerId);
		w.classList.add("drag");
	});
	w.addEventListener("pointermove", (e) => {
		if (!drag) return;
		const r = w.getBoundingClientRect();
		const vw = document.documentElement.clientWidth || innerWidth, vh = innerHeight;
		const x = Math.min(Math.max(8, e.clientX - drag.dx), vw - r.width - 8), y = Math.min(Math.max(8, e.clientY - drag.dy), vh - r.height - 8);
		drag.moved = true;
		host.style.transform = `translate(${x}px, ${y}px)`;
		pos = { x: (x - 8) / Math.max(1, vw - r.width - 16), y: (y - 8) / Math.max(1, vh - r.height - 16), c: w.classList.contains("c") };
	});
	const end = () => { if (!drag) return; w.classList.remove("drag"); if (drag.moved) save(); drag = null; };
	w.addEventListener("pointerup", end);
	w.addEventListener("pointercancel", end);
	addEventListener("resize", () => host.isConnected && place());

	const left = () => (pomo.running ? Math.max(0, pomo.endAt - Date.now()) : pomo.remaining ?? DUR[pomo.mode]);
	function draw() {
		const showDone = Date.now() < doneUntil;
		const active = wt && wt.on && pomo && (pomo.running || left() < DUR[pomo.mode || "focus"]);
		if (!active && !showDone) {
			host.remove();
			clearInterval(tick);
			tick = 0;
			return;
		}
		if (!host.isConnected) {
			(document.body || document.documentElement).append(host);
			w.classList.toggle("c", !!(pos && pos.c));
			requestAnimationFrame(place);
		}
		if (!tick) tick = setInterval(draw, 1000);
		w.dir = lang === "fa" ? "rtl" : "ltr";
		b1.title = b1.ariaLabel = s(pomo && pomo.running ? "pause" : "resume");
		b2.title = b2.ariaLabel = s("stop");
		w.title = s("drag");
		if (showDone && !active) {
			w.className = "w" + (w.classList.contains("c") ? " c" : "");
			tEl.textContent = "✓";
			lEl.textContent = s("done");
			b1.style.display = b2.style.display = "none";
			fg.style.strokeDashoffset = 0;
			return;
		}
		b1.style.display = b2.style.display = "";
		const ms = left(), total = Math.ceil(ms / 1000);
		tEl.textContent = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
		const brk = pomo.mode !== "focus";
		w.classList.toggle("brk", brk);
		w.classList.toggle("p", !pomo.running);
		lEl.textContent = !pomo.running ? s("paused") : s(brk ? "brk" : "focus");
		b1.textContent = pomo.running ? "❚❚" : "▶";
		fg.style.strokeDashoffset = C * (1 - ms / DUR[pomo.mode || "focus"]);
	}
	chrome.storage.local.get([POMO, WT, POS, "hamyar_data"]).then((r) => {
		pomo = r[POMO] || null;
		wt = r[WT] || null;
		pos = r[POS] || null;
		lang = (r.hamyar_data && r.hamyar_data.settings && r.hamyar_data.settings.lang) || (navigator.language || "en").slice(0, 2);
		draw();
	});
	chrome.storage.onChanged.addListener((c, area) => {
		if (area !== "local") return;
		if (c[POMO]) pomo = c[POMO].newValue || null;
		if (c[WT]) {
			const was = wt && wt.on;
			wt = c[WT].newValue || null;
			if (was && !(wt && wt.on) && wt && wt.finished) doneUntil = Date.now() + 7000;
		}
		if (c[POS]) { pos = c[POS].newValue || null; if (host.isConnected && !drag) place(); }
		if (c.hamyar_data) { const l = c.hamyar_data.newValue?.settings?.lang; if (l) lang = l; }
		draw();
	});
})();
