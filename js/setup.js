/* First-run setup: a few friendly questions before the tour. Language; bringing data in (Google
 * account / Drive, Dastyar, a backup file); name and birthday; city; look; which boxes and helpers to show.
 * Every answer is saved as soon as it is given, and everything can be changed later in Settings.
 * Shown once (kamyar_setup_done); existing installs that already finished the tour skip it. */
(function () {
	"use strict";
	const { $, el, setting } = H;
	const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
	const LANGS = [["fa", "فارسی"], ["en", "English"], ["fr", "Français"], ["de", "Deutsch"]];
	const STEPS = ["welcome", "data", "you", "city", "look", "boxes", "flag", "done"];
	let i = 0;

	const head = (title, text) => [el("h2", { class: "setup-h" }, t(title)), text ? el("p", { class: "muted setup-p" }, t(text)) : null];
	const option = (ic, title, text, btn) => el("div", { class: "setup-opt" }, el("span", { class: "setup-ic" }, ic), el("div", { class: "grow" }, el("strong", {}, t(title)), el("p", { class: "muted small" }, t(text))), btn);
	function sw(ic, label, on, change) {
		return el("label", { class: "manage-item" + (on ? " on" : "") }, el("span", { class: "manage-ic" }, ic), el("span", { class: "manage-name" }, t(label)),
			el("input", { type: "checkbox", class: "switch", checked: on, onchange: (e) => { e.target.closest(".manage-item").classList.toggle("on", e.target.checked); change(e.target.checked); } }));
	}

	const view = {
		welcome() {
			const cur = I18n.lang;
			return [
				el("img", { class: "setup-logo", src: "icons/icon-128.png", alt: "" }),
				...head("setupHi", "setupHiText"),
				el("div", { class: "setup-langs" }, ...LANGS.map(([code, name]) =>
					el("button", { type: "button", class: "setup-chip" + (code === cur ? " on" : ""), onclick: () => Store.setSetting("lang", code) }, name)))
			];
		},
		data() {
			const msg = el("p", { class: "setup-msg small", role: "status" });
			const cs = window.ChromeSync ? ChromeSync.status : {};
			const out = [...head("setupDataT", "setupDataText")];
			out.push(option("🔄", "setupChromeT", cs.email ? t("setupChromeOn", { email: cs.email }) : "setupChromeOff", null));
			if (H.oauthReady && H.oauthReady()) {
				const b = el("button", { type: "button", class: "btn", onclick: async () => {
					b.disabled = true;
					msg.textContent = t("setupWorking");
					try {
						await H.driveConnect();
						msg.textContent = t("setupDriveOk", { n: Object.values(Store.get().items).filter((x) => !x.deleted).length });
						b.textContent = "✓";
					} catch (e) {
						msg.textContent = H.oauthError ? H.oauthError(e) : String(e);
						b.disabled = false;
					}
				} }, t("connectDrive"));
				out.push(option("☁️", "setupDriveT", "setupDriveText", b));
			}
			out.push(option("📥", "setupDastyarT", "setupDastyarText", el("button", { type: "button", class: "btn btn-ghost", onclick: () => $("dastyarBtn").click() }, t("fromDastyarBtn"))));
			out.push(option("🗂️", "setupBackupT", "setupBackupText", el("button", { type: "button", class: "btn btn-ghost", onclick: () => $("importInput").click() }, t("importFile"))));
			out.push(msg, el("p", { class: "muted small" }, t("setupDataFresh")));
			return out;
		},
		you() {
			return [
				...head("setupYouT", "setupYouText"),
				el("div", { class: "fld" }, el("span", {}, t("avChoose")), H.avatarPicker(true)),
				el("label", { class: "fld" }, el("span", {}, t("setupName")), el("input", { type: "text", maxlength: 40, value: setting("name", ""), placeholder: t("setupNamePh"), oninput: (e) => Store.setSetting("name", e.target.value.trim()) })),
				el("div", { class: "fld" }, el("span", {}, t("setupBirthday")), H.bdayPicker()),
				el("p", { class: "muted small" }, t("setupYouNote"))
			];
		},
		city() {
			const list = el("ul", { class: "setup-cities" });
			const input = el("input", { type: "text", placeholder: t("cityPh"), value: (setting("city") || {}).name || "" });
			const now = el("p", { class: "setup-msg small" }, setting("city") ? "✓ " + setting("city").name : "");
			const form = el("form", { class: "setup-row", onsubmit: async (e) => {
				e.preventDefault();
				const q = input.value.trim();
				if (!q) return;
				list.replaceChildren(el("li", { class: "muted small" }, t("searching")));
				try {
					const r = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${I18n.lang}&format=json`)).json();
					const res = r.results || [];
					if (!res.length) return list.replaceChildren(el("li", { class: "muted small" }, t("cityNotFound")));
					list.replaceChildren(...res.map((p) => el("li", {}, el("button", { type: "button", class: "setup-chip", onclick: () => {
						Store.setSetting("city", { name: p.name, lat: +p.latitude.toFixed(3), lon: +p.longitude.toFixed(3), tz: p.timezone || null });
						list.replaceChildren();
						now.textContent = "✓ " + p.name;
					} }, [p.name, p.admin1, p.country].filter(Boolean).join("، ")))));
				} catch {
					list.replaceChildren(el("li", { class: "error small" }, t("searchFail")));
				}
			} }, input, el("button", { type: "submit", class: "btn" }, t("search")));
			return [...head("setupCityT", "setupCityText"), form, now, list];
		},
		look() {
			const cur = setting("theme", "dark");
			const active = Themes.hasWall() ? Themes.activeWall() : null;
			const pick = async (id) => {
				if (id) {
					await Themes.useWall(id);
					Store.setSetting("wallBuiltin", id);
				} else {
					Themes.setWallpaper(null);
					Store.setSetting("wallBuiltin", "");
				}
				draw();
			};
			return [
				...head("setupLookT", "setupLookText"),
				el("div", { class: "setup-langs" }, ...[["dark", "🌙", "setupDark"], ["light", "☀️", "setupLight"], ["auto", "🖥️", "setupAuto"]].map(([id, ic, label]) =>
					el("button", { type: "button", class: "setup-chip" + (cur === id ? " on" : ""), onclick: () => { Store.setSetting("theme", id); } }, ic, " ", t(label)))),
				el("div", { class: "setup-walls" },
					el("button", { type: "button", class: "setup-wall none" + (!active ? " on" : ""), onclick: () => pick(null) }, t("setupNoWall")),
					...Themes.BUILTIN.map((w) => el("button", { type: "button", class: "setup-wall" + (w.id === active ? " on" : ""), onclick: () => pick(w.id) }, el("img", { src: w.thumb, alt: "", loading: "lazy" })))),
				el("h4", {}, t("colorWalls")),
				el("div", { class: "setup-walls colors" }, ...Themes.colors().map((w) => el("button", { type: "button", class: "setup-wall" + (w.id === active ? " on" : ""), title: w.id.slice(2), onclick: () => pick(w.id) }, el("img", { src: w.thumb, alt: "" })))),
				el("h4", {}, t("boxAlphaTitle")),
				el("p", { class: "muted small" }, t(Themes.hasWall() || Themes.hasVideo() ? "boxAlphaHint" : "boxAlphaNoWall")),
				...[["boxAlphaIdle", 0], ["boxAlphaHover", 1]].map(([label, k]) => {
					const outEl = el("output", { class: "small muted" }, H.num(Themes.boxAlpha()[k]) + (I18n.lang === "fa" ? "٪" : "%"));
					const r = el("input", { type: "range", min: 0, max: 100, step: 5, value: Themes.boxAlpha()[k], oninput: (e) => {
						const v = Number(e.target.value);
						Themes.setBoxAlpha(k ? null : v, k ? v : null);
						outEl.textContent = H.num(v) + (I18n.lang === "fa" ? "٪" : "%");
					}, onchange: () => Store.setSetting("boxAlpha", Themes.boxAlpha()) });
					return el("label", { class: "range-row setup-range" }, el("span", {}, t(label)), r, outEl);
				}),
				el("p", { class: "muted small" }, t("setupLookNote"))
			];
		},
		boxes() {
			const widgets = () => setting("widgets", {}) || {};
			const care = () => setting("care", {}) || {};
			const salat = () => setting("salat", {}) || {};
			const ICON = { calendar: "📅", weather: "⛅", rates: "💱", prayer: "🕌", daily: "📝", tools: "🧰", habits: "✅", expenses: "💳", sounds: "🎧", alerts: "🔔", snippets: "📋", pomodoro: "🍅", focusStats: "📊", care: "💧", goals: "🎯", journal: "🙏", worldclock: "🌍", football: "⚽", trip: "⏳" };
			return [
				...head("setupBoxesT", "setupBoxesText"),
				el("div", { class: "manage-grid setup-grid" }, ...H.WIDGETS.map((w) => sw(ICON[w] || "▫️", H.widgetLabel[w], H.widgetOn(w), (on) => Store.setSetting("widgets", { ...widgets(), [w]: on })))),
				el("h4", {}, t("setupHelpers")),
				el("div", { class: "manage-grid setup-grid" },
					sw("💧", "careWater", care().water?.on !== false, (on) => Store.setSetting("care", { ...care(), water: { every: 60, ...(care().water || {}), on } })),
					sw("👀", "careEye", care().eye?.on !== false, (on) => Store.setSetting("care", { ...care(), eye: { every: 20, ...(care().eye || {}), on } })),
					sw("🕌", "salatRemind", !!salat().on, (on) => Store.setSetting("salat", { ...salat(), on })),
					sw("🎉", "seasonal", setting("seasonal", true) !== false, (on) => Store.setSetting("seasonal", on)),
					sw("🧠", "smartBm", !!setting("smartBm", false), (on) => Store.setSetting("smartBm", on))),
				el("p", { class: "muted small" }, t("setupBoxesNote"))
			];
		},
		flag() {
			// Off unless the user says yes here (or later in Boxes and features).
			const on = !!setting("siteFlag", false);
			const pick = (v) => H.setSiteFlag(v).then(() => draw());
			return [
				el("div", { class: "flag-demo", "aria-hidden": "true" },
					...["ir", "de", "us"].map((c) => el("span", { class: "flag-demo-ic" }, el("img", { src: "icons/flag-demo-" + c + ".png", alt: "" })))),
				...head("siteFlagT", "siteFlagText"),
				el("div", { class: "setup-langs" },
					el("button", { type: "button", class: "setup-chip" + (on ? " on" : ""), onclick: () => pick(true) }, "✓ " + t("siteFlagYes")),
					el("button", { type: "button", class: "setup-chip" + (on ? "" : " on"), onclick: () => pick(false) }, t("siteFlagNo"))),
				el("p", { class: "muted small" }, t("siteFlagNote"), " ", el("a", { href: "https://db-ip.com", target: "_blank", rel: "noopener", dir: "ltr", style: "unicode-bidi:isolate;white-space:nowrap" }, "IP Geolocation by DB-IP"))
			];
		},
		done() {
			const name = setting("name", "");
			return [el("div", { class: "setup-party" }, "🎉"), el("h2", { class: "setup-h" }, name ? t("setupDoneName", { name }) : t("setupDoneT")), el("p", { class: "muted setup-p" }, t("setupDoneText"))];
		}
	};

	function draw() {
		const k = STEPS[i];
		$("setupBody").replaceChildren(...view[k]().filter(Boolean));
		$("setupBody").dataset.step = k;
		$("setupStep").textContent = t("tourStep", { n: H.num(i + 1), all: H.num(STEPS.length) });
		$("setupDots").replaceChildren(...STEPS.map((_, n) => el("span", { class: n === i ? "on" : "" })));
		$("setupPrev").hidden = i === 0;
		$("setupNext").textContent = t(k === "welcome" ? "setupStart" : k === "done" ? "setupTour" : "tourNext");
		$("setupSkip").textContent = t(k === "done" ? "setupNoTour" : "setupSkipAll");
	}
	function open() {
		document.querySelectorAll("dialog[open]").forEach((d) => d.close());
		H.showView?.("home");
		i = 0;
		$("setup").hidden = false;
		draw();
		$("setupNext").focus();
	}
	function finish(tour) {
		$("setup").hidden = true;
		ls("kamyar_setup_done", "1");
		if (tour) setTimeout(() => H.startTour?.(), 250);
		else ls("kamyar_tour_done", "1");
	}
	$("setupNext").addEventListener("click", () => (i < STEPS.length - 1 ? (i++, draw()) : finish(true)));
	$("setupPrev").addEventListener("click", () => i > 0 && (i--, draw()));
	$("setupSkip").addEventListener("click", () => finish(STEPS[i] !== "done"));
	document.addEventListener("keydown", (e) => {
		if ($("setup").hidden || e.target.matches("input, textarea, select")) return;
		if (e.key === "Escape") { e.preventDefault(); finish(true); }
	}, true);

	// Redraw on changes made here (language, theme…) without losing what is being typed.
	H.onRefresh(() => {
		if ($("setup").hidden) return;
		const k = STEPS[i];
		if (k !== "welcome" && k !== "look") {
			$("setupStep").textContent = t("tourStep", { n: H.num(i + 1), all: H.num(STEPS.length) });
			return;
		}
		draw();
	});

	const pending = () => !ls("kamyar_setup_done");
	H.setupPending = pending;
	H.startSetup = open;
	(window.hamyarReady || Promise.resolve()).then(() => {
		// Installs from before this version that already saw the tour don't get asked.
		if (ls("kamyar_tour_done") && pending()) ls("kamyar_setup_done", "1");
		if (pending()) setTimeout(open, 300);
	});
})();
