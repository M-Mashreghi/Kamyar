/* Settings window: side sections (profile, background, theme, general, calendar, privacy, data, about),
 * Google account (Chrome profile) with avatar, font cards, colour circles, video background and occasion categories. */
(function () {
	"use strict";
	const { $, el, setting } = H;
	const ls = (k, v) => {
		try {
			if (v === undefined) return localStorage.getItem(k);
			localStorage.setItem(k, v);
		} catch {}
	};

	/* ---------- sections ---------- */
	let sec = ls("hamyar_set_sec") || "profile";
	function showSec(s) {
		if (!document.querySelector(`.set-sec[data-sec="${s}"]`)) s = "profile";
		sec = s;
		ls("hamyar_set_sec", s);
		document.querySelectorAll(".set-sec").forEach((x) => (x.hidden = x.dataset.sec !== s));
		document.querySelectorAll(".set-tab").forEach((x) => x.classList.toggle("active", x.dataset.sec === s));
		$("setSecTitle").textContent = t("sec_" + s);
		document.querySelector(".set-body").scrollTop = 0;
	}
	document.querySelectorAll(".set-tab").forEach((b) => b.addEventListener("click", () => showSec(b.dataset.sec)));
	H.settingsSection = (s) => {
		showSec(s);
		$("settingsBtn").click();
	};

	/* ---------- profile & Google account ---------- */
	let email = "";
	async function loadEmail() {
		try {
			const info = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" });
			email = (info && info.email) || "";
		} catch {
			email = "";
		}
	}
	function avatarEl(size) {
		const a = setting("avatar", "");
		if (a) return el("img", { src: a, alt: "", width: String(size), height: String(size), class: "avatar-img" });
		const who = setting("name", "") || email || "H";
		return el("span", { class: "avatar-letter", style: `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px` }, who.trim().charAt(0).toUpperCase());
	}
	function renderProfile() {
		$("profAvatar").replaceChildren(avatarEl(88));
		$("profName").textContent = setting("name", "") || t("noName");
		$("profEmail").textContent = setting("username", "") ? "@" + setting("username", "") : email;
		$("avatarRemove").hidden = !setting("avatar", "");
		$("acctStatus").textContent = email ? t("acctSignedIn", { email }) : t("acctSignedOut");
		$("acctBtn").textContent = t(email ? "acctManage" : "acctSignIn");
		$("acctBtn").className = email ? "btn btn-ghost" : "btn";
		$("usernameInput").value = setting("username", "");
		const bd = setting("birthday", "");
		$("bdayInput").value = bd && bd.date ? bd.date : "";
	}
	// Chrome's own page for signing in, switching or signing out of the Google account.
	$("acctBtn").addEventListener("click", () => chrome.tabs.create({ url: "chrome://settings/people" }));
	$("avatarBtn").addEventListener("click", () => $("avatarInput").click());
	$("avatarInput").addEventListener("change", async (e) => {
		const f = e.target.files[0];
		e.target.value = "";
		if (!f) return;
		try {
			Store.setSetting("avatar", await squareImage(f, 128));
		} catch {
			H.toast(t("wallBad"));
		}
	});
	$("avatarRemove").addEventListener("click", () => Store.setSetting("avatar", ""));
	$("usernameInput").addEventListener("change", (e) => Store.setSetting("username", e.target.value.trim().replace(/^@/, "")));
	$("bdayInput").addEventListener("change", (e) => {
		const v = e.target.value;
		const old = setting("birthday", "");
		Store.setSetting("birthday", v ? { date: v, cal: (old && old.cal) || (I18n.lang === "fa" ? "persian" : "gregory") } : "");
	});
	// Small square JPEG so the avatar fits in Chrome Sync next to everything else.
	function squareImage(file, size) {
		return new Promise((resolve, reject) => {
			if (!/^image\//.test(file.type)) return reject(new Error("type"));
			const url = URL.createObjectURL(file);
			const im = new Image();
			im.onload = () => {
				URL.revokeObjectURL(url);
				const s = Math.min(im.naturalWidth, im.naturalHeight);
				const c = document.createElement("canvas");
				c.width = c.height = size;
				c.getContext("2d").drawImage(im, (im.naturalWidth - s) / 2, (im.naturalHeight - s) / 2, s, s, 0, 0, size, size);
				let q = 0.85, data = c.toDataURL("image/jpeg", q);
				while (data.length > 14000 && q > 0.4) data = c.toDataURL("image/jpeg", (q -= 0.1));
				resolve(data);
			};
			im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
			im.src = url;
		});
	}

	/* ---------- rail: avatar instead of the gear ---------- */
	const gear = $("settingsBtn").innerHTML;
	function renderRailAvatar() {
		if (setting("avatar", "")) $("settingsBtn").replaceChildren(avatarEl(34));
		else $("settingsBtn").innerHTML = gear;
		$("settingsBtn").classList.toggle("has-avatar", !!setting("avatar", ""));
	}

	/* ---------- theme: modes, colours, fonts ---------- */
	const MODES = [["light", "mode-light"], ["dark", "mode-dark"], ["auto", "mode-auto"], ["daynight", "mode-dn"]];
	const ACCENTS = [["#3f75ff", "blue"], ["#3db985", "green"], ["#6c4ff0", "purple"], ["#ec4899", "pink"], ["#ef4444", "red"], ["#f28c28", "orange"], ["#14b8a6", "teal"]];
	const LATIN = new Set(["inter", "lora", "jetbrains"]);
	function renderTheme() {
		const cur = setting("theme", "dark");
		$("modeRow").replaceChildren(...MODES.map(([id, cls]) => {
			const th = Themes.byId[id];
			return el("button", { type: "button", class: "circle-opt", "aria-pressed": String(cur === id), onclick: () => Store.setSetting("theme", id) },
				el("span", { class: "circle " + cls }, cur === id ? "✓" : ""), el("small", {}, th.names[I18n.lang] || th.names.en));
		}));
		const acc = (setting("accent", "") || "").toLowerCase();
		$("accentRow").replaceChildren(...ACCENTS.map(([hex, name]) =>
			el("button", { type: "button", class: "circle-opt", "aria-pressed": String(acc === hex), title: t("c_" + name), onclick: () => Store.setSetting("accent", hex) },
				el("span", { class: "circle", style: `background:${hex}` }, acc === hex ? "✓" : ""), el("small", {}, t("c_" + name)))));
		const font = setting("font", "vazir");
		const ai = $("accentInput"); if (ai && /^#[0-9a-f]{6}$/.test(acc)) ai.value = acc;
		if (!$("fontSelect").options.length) $("fontSelect").replaceChildren(...Themes.FONT_LIST.map(([id, , name]) => el("option", { value: id }, name)));
		$("fontSelect").value = font;
		$("fontGrid").replaceChildren(...Themes.FONT_LIST.map(([id, fam, name]) =>
			el("button", { type: "button", class: "font-card" + (font === id ? " on" : ""), "aria-pressed": String(font === id), "data-font": id, onclick: () => { $("fontSelect").value = id; $("fontSelect").dispatchEvent(new Event("change")); } },
				el("span", { class: "fc-sample", style: `font-family:${fam}`, dir: LATIN.has(id) ? "ltr" : null }, LATIN.has(id) ? "Kamyar · Aa Bb 123" : t("fontSample")), el("small", {}, name))));
	}

	/* ---------- video background ---------- */
	let videoUrl = null;
	async function playVideo() {
		const v = $("bgVideo");
		if (videoUrl) URL.revokeObjectURL(videoUrl);
		videoUrl = null;
		const rec = Themes.hasVideo() ? await Themes.getVideo().catch(() => null) : null;
		if (!rec || !rec.blob) {
			v.hidden = true;
			v.removeAttribute("src");
			v.load();
			return;
		}
		videoUrl = URL.createObjectURL(rec.blob);
		v.src = videoUrl;
		v.hidden = false;
		v.play().catch(() => {});
	}
	async function renderVideo() {
		const rec = Themes.hasVideo() ? await Themes.getVideo().catch(() => null) : null;
		$("videoInfo").textContent = rec ? `🎬 ${rec.name || "video"} · ${(rec.size / 1048576).toFixed(1)} MB` : "";
		$("videoRemove").hidden = !rec;
		$("wallDimRow").hidden = !(Themes.hasWall() || Themes.hasVideo());
	}
	$("videoInput").addEventListener("change", async (e) => {
		const f = e.target.files[0];
		e.target.value = "";
		if (!f) return;
		if (!/^video\//.test(f.type)) return H.toast(t("videoBad"));
		if (f.size > 120 * 1048576) return H.toast(t("videoTooBig"));
		try {
			await Themes.setVideo(f);
		} catch {
			return H.toast(t("videoTooBig"));
		}
		await playVideo();
		renderVideo();
	});
	$("videoRemove").addEventListener("click", async () => {
		await Themes.setVideo(null);
		await playVideo();
		renderVideo();
	});
	// Save battery: pause the video when the tab is hidden.
	document.addEventListener("visibilitychange", () => {
		const v = $("bgVideo");
		if (v.hidden) return;
		document.hidden ? v.pause() : v.play().catch(() => {});
	});

	/* ---------- calendar occasion categories ---------- */
	function renderCats() {
		const off = setting("occCats", {}) || {};
		$("occCats").replaceChildren(...Occasions.CATS.map(([id, emoji]) =>
			el("label", { class: "tog-card" }, el("span", { class: "tc-ic" }, emoji),
				el("span", { class: "grow" }, el("strong", {}, t("cat_" + id)), el("small", { class: "muted" }, t("catd_" + id))),
				el("input", { type: "checkbox", class: "switch", checked: off[id] !== false, onchange: (e) => Store.setSetting("occCats", { ...(setting("occCats", {}) || {}), [id]: e.target.checked }) }))));
	}

	function renderAll() {
		renderProfile();
		renderTheme();
		renderVideo();
		renderCats();
		$("aboutVer").textContent = chrome.runtime.getManifest().version;
	}
	$("settingsBtn").addEventListener("click", () => {
		showSec(sec);
		loadEmail().then(renderProfile);
		renderAll();
	});
	H.onRefresh(() => {
		renderRailAvatar();
		if ($("settingsDialog").open) renderAll();
	});
	loadEmail();
	playVideo();
})();
