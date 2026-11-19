/* Welcome sound (off by default): a gentle chime when a Rubi tab opens. Built-in chimes are made
 * with Web Audio (js/chimes.js); people can also upload their own short sound, which stays on this
 * device (chrome.storage.local, kamyar_welcome_custom). If Chrome blocks sound on a fresh tab, the
 * background plays it through the offscreen document instead.
 * Setting: settings.welcomeSound = { on, id, vol, when: "tab" | "hour" | "day" } */
(function () {
	"use strict";
	const { $, el, setting, toast } = H;
	const CUSTOM = "kamyar_welcome_custom", LAST = "kamyar_welcome_at";
	const MAX = 2 * 1024 * 1024;
	const DEF = { on: false, id: "crystal", vol: 0.6, when: "tab" };
	const cfg = () => ({ ...DEF, ...(setting("welcomeSound", {}) || {}) });
	const save = (patch) => Store.setSetting("welcomeSound", { ...cfg(), ...patch });
	const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
	const custom = async () => (await chrome.storage.local.get(CUSTOM))[CUSTOM] || null;
	const NAMES = { crystal: "chCrystal", morning: "chMorning", harp: "chHarp", bowl: "chBowl", kalimba: "chKalimba", drop: "chDrop", breeze: "chBreeze" };

	const wait = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("timeout"), ms))]);
	// Play here if Chrome lets this page make sound; otherwise ask the background to play it.
	async function play(c = cfg(), preview = false) {
		const data = c.id === "custom" ? await custom() : null;
		if (c.id === "custom" && !data) return false;
		try {
			if (data) {
				const a = new Audio(data.data);
				a.volume = c.vol;
				if ((await wait(a.play().then(() => "ok"), 400)) === "ok") return true;
				a.pause();
			} else {
				const ctx = new AudioContext();
				if (ctx.state !== "running") await wait(ctx.resume(), 300);
				if (ctx.state === "running") {
					Chimes.play(ctx, c.id, c.vol);
					setTimeout(() => ctx.close(), 6000);
					return true;
				}
				ctx.close();
			}
		} catch {}
		if (preview) return false;
		chrome.runtime.sendMessage({ type: "kamyar-welcome-play", id: c.id, vol: c.vol, data: data && data.data }).catch(() => {});
		return true;
	}
	H.playWelcome = play;

	function due(c) {
		const last = +ls(LAST) || 0, now = Date.now();
		if (c.when === "hour") return now - last > 3600e3;
		if (c.when === "day") return new Date(last).toDateString() !== new Date(now).toDateString();
		return true;
	}
	async function onOpen() {
		await window.hamyarReady;
		const c = cfg();
		if (!c.on || !due(c)) return;
		const go = () => { ls(LAST, String(Date.now())); play(c); };
		if (document.visibilityState === "visible") go();
		else document.addEventListener("visibilitychange", function v() { if (document.visibilityState === "visible") { document.removeEventListener("visibilitychange", v); if (due(c)) go(); } });
	}

	/* ---------- settings ---------- */
	async function render() {
		const box = $("welcomeSoundBox");
		if (!box) return;
		const c = cfg(), cu = await custom();
		const opt = (id, label) => el("div", { class: "ws-opt" + (c.id === id ? " on" : "") },
			el("button", { type: "button", class: "ws-pick", "aria-pressed": String(c.id === id), onclick: () => { save({ id }); play({ ...c, id }, true); } }, el("span", { class: "ws-dot" }), label),
			el("button", { type: "button", class: "icon-btn small ws-play", title: t("chPreview"), "aria-label": t("chPreview"), onclick: () => play({ ...c, id }, true) }, "▶"));
		const file = el("input", { type: "file", accept: "audio/*", hidden: true, style: "display:none", onchange: async (e) => {
			const f = e.target.files[0];
			e.target.value = "";
			if (!f) return;
			if (f.size > MAX) return toast(t("chTooBig"));
			const data = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
			await chrome.storage.local.set({ [CUSTOM]: { name: f.name, data } });
			save({ id: "custom" });
			play({ ...cfg(), id: "custom" }, true);
			render();
		} });
		box.replaceChildren(
			el("label", { class: "tog-card" }, el("span", { class: "tc-ic" }, "🔔"),
				el("span", { class: "grow" }, el("strong", {}, t("welcomeSound")), el("small", { class: "muted" }, t("welcomeSoundHint"))),
				el("input", { type: "checkbox", class: "switch", checked: c.on, onchange: (e) => { save({ on: e.target.checked }); if (e.target.checked) play(cfg(), true); render(); } })),
			el("div", { class: "ws-body", hidden: !c.on },
				el("div", { class: "ws-list" }, ...Chimes.ids.map((id) => opt(id, t(NAMES[id] || id))),
					cu ? opt("custom", el("bdi", { dir: "auto" }, "🎵 " + cu.name)) : ""),
				el("div", { class: "ws-row" },
					el("button", { type: "button", class: "btn btn-ghost small", onclick: () => file.click() }, "⬆️ " + t(cu ? "chReplace" : "chUpload")),
					cu ? el("button", { type: "button", class: "link-btn", onclick: async () => { await chrome.storage.local.remove(CUSTOM); if (cfg().id === "custom") save({ id: "crystal" }); render(); } }, t("chRemove")) : "",
					file),
				el("p", { class: "muted small" }, t("chUploadHint")),
				el("label", { class: "fld range-row ws-vol" }, el("span", {}, "🔉 " + t("chVolume")),
					el("input", { type: "range", min: 5, max: 100, step: 5, value: Math.round(c.vol * 100), onchange: (e) => { save({ vol: e.target.value / 100 }); play(cfg(), true); } })),
				el("label", { class: "fld" }, el("span", {}, t("chWhen")),
					el("select", { onchange: (e) => save({ when: e.target.value }) }, ...["tab", "hour", "day"].map((w) => el("option", { value: w, selected: c.when === w }, t("chWhen_" + w)))))));
	}
	H.renderWelcomeSound = render;
	render();
	let sig = "";
	H.onRefresh(() => { const s = JSON.stringify(cfg()) + I18n.lang; if (s !== sig) { sig = s; render(); } });
	onOpen();
})();
