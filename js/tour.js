/* First-run tour: a few steps that light up one part of the page at a time and say what it does.
 * Shown once (kamyar_tour_done); Settings › About can start it again. */
(function () {
	"use strict";
	const { $, el, num } = H;
	const STEPS = [
		{ title: "tour1T", text: "tour1" },
		{ sel: ".search-wrap", title: "tour2T", text: "tour2" },
		{ sel: "#bookmarkList", title: "tour3T", text: "tour3" },
		{ sel: ".rail:not(.rail-2)", title: "tour4T", text: "tour4" },
		{ sel: ".rail.rail-2", title: "tour5T", text: "tour5" },
		{ sel: '[data-widget="calendar"]', title: "tour6T", text: "tour6" },
		{ sel: '[data-go="tools"]', title: "tour7T", text: "tour7" },
		{ sel: '[data-widget="daily"]', title: "tourBoxT", text: "tourBox", cls: "tour-boxes" },
		{ sel: "#settingsBtn", title: "tour8T", text: "tour8" },
		{ title: "tour9T", text: "tour9" }
	];
	let i = 0;
	const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
	const visible = (n) => n && n.getClientRects().length && getComputedStyle(n).visibility !== "hidden";

	function place() {
		const s = STEPS[i];
		const target = s.sel && document.querySelector(s.sel);
		const hole = $("tour").querySelector(".tour-hole");
		const tip = $("tour").querySelector(".tour-tip");
		if (visible(target)) {
			target.scrollIntoView({ block: "nearest" });
			const r = target.getBoundingClientRect();
			const pad = 6;
			Object.assign(hole.style, { display: "block", left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
			$("tour").classList.remove("center");
			// Tip goes below the target if there is room, otherwise above; beside it for the tall side rails.
			const tw = Math.min(360, innerWidth - 32), th = tip.offsetHeight || 220;
			let left, top;
			if (r.height > innerHeight * 0.6) {
				left = r.right + 16 + tw < innerWidth ? r.right + 16 : r.left - 16 - tw;
				top = Math.min(innerHeight - th - 16, Math.max(16, r.top + 40));
			} else {
				left = Math.min(innerWidth - tw - 16, Math.max(16, r.left + r.width / 2 - tw / 2));
				top = r.bottom + 14 + th < innerHeight ? r.bottom + 14 : Math.max(16, r.top - th - 14);
			}
			Object.assign(tip.style, { left: left + "px", top: top + "px", width: tw + "px" });
		} else {
			hole.style.display = "none";
			$("tour").classList.add("center");
			Object.assign(tip.style, { left: "", top: "", width: "" });
		}
	}
	function draw() {
		const s = STEPS[i];
		$("tourStep").textContent = t("tourStep", { n: num(i + 1), all: num(STEPS.length) });
		$("tourTitle").textContent = t(s.title);
		$("tourText").textContent = t(s.text);
		$("tourDots").replaceChildren(...STEPS.map((_, k) => el("span", { class: k === i ? "on" : "" })));
		$("tourPrev").hidden = i === 0;
		$("tourNext").textContent = t(i === STEPS.length - 1 ? "tourDone" : "tourNext");
		document.documentElement.classList.toggle("tour-boxes", s.cls === "tour-boxes");
		place();
		requestAnimationFrame(place);
		$("tourNext").focus();
	}
	function start() {
		if (document.documentElement.classList.contains("focus-on")) return;
		document.querySelectorAll("dialog[open]").forEach((d) => d.close());
		if (H.showView) H.showView("home");
		i = 0;
		$("tour").hidden = false;
		draw();
	}
	function end() {
		$("tour").hidden = true;
		document.documentElement.classList.remove("tour-boxes");
		ls("kamyar_tour_done", "1");
	}
	H.startTour = start;
	H.tourOpen = () => !$("tour").hidden;
	$("tourNext").addEventListener("click", () => (i < STEPS.length - 1 ? (i++, draw()) : end()));
	$("tourPrev").addEventListener("click", () => i > 0 && (i--, draw()));
	$("tourSkip").addEventListener("click", end);
	$("tourAgain").addEventListener("click", () => { $("settingsDialog")?.close?.(); start(); });
	document.addEventListener("keydown", (e) => {
		if ($("tour").hidden) return;
		const rtl = document.documentElement.dir === "rtl";
		if (e.key === "Escape") { e.preventDefault(); end(); }
		else if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) $("tourNext").click();
		else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) $("tourPrev").click();
	}, true);
	addEventListener("resize", () => !$("tour").hidden && place());
	H.onRefresh(() => !$("tour").hidden && draw());
	(window.hamyarReady || Promise.resolve()).then(() => {
		if (!ls("kamyar_tour_done")) setTimeout(start, 600);
	});
})();
