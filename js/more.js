/* Kamyar: morning brief, focus mode (with blocked sites) and a simple expense tracker. */
(function () {
	"use strict";
	const { $, el, num, setting, toast } = H;
	const pad = (n) => String(n).padStart(2, "0");
	const dstr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
	const noon = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
	const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
	const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

	/* ---------- morning brief ---------- */
	function section(icon, title, ...body) {
		return el("section", { class: "brief-sec" }, el("h4", {}, icon + " " + title), ...body);
	}
	function drawBrief() {
		const d = new Date(), today = dstr(d), n = noon(d);
		const [main, second] = H.calOrder();
		const out = [
			el("div", { class: "brief-head" },
				el("strong", { class: "brief-greet", dir: "auto" }, $("greeting").textContent),
				el("span", { class: "muted" }, H.fmtDate(d, main) + " · " + H.fmtDate(d, second, false)))
		];
		// Weather and today's occasions
		const wx = H.wx;
		const occ = window.Occasions ? Occasions.forDay(n, { iran: setting("iranHolidays", true), world: setting("worldDays", true), cats: setting("occCats", {}) || {} }) : [];
		const top = [];
		if (wx) top.push(el("div", { class: "brief-chip" }, `${wx.icon} ${wx.label} · ${wx.temp}° `, el("small", { class: "muted" }, `(${wx.lo}° / ${wx.hi}°) ${wx.city || ""}`)));
		for (const o of occ.slice(0, 4)) top.push(el("div", { class: "brief-chip" + (o.off ? " off" : "") }, o.emoji + " " + o.name));
		if (top.length) out.push(el("div", { class: "brief-chips" }, ...top));

		// Events and birthdays today
		const evs = Store.list("event").filter((ev) => EvCore.matches(ev, n)).sort((a, b) => String(a.start || "").localeCompare(String(b.start || "")));
		out.push(section("📅", t("briefEvents"),
			evs.length
				? el("ul", { class: "brief-list" }, ...evs.map((ev) => {
					if (ev.kind === "birthday") {
						const age = EvCore.ageOn(ev, n);
						return el("li", {}, "🎂 ", el("span", { dir: "auto" }, age > 0 ? t("bdayTitleAge", { name: ev.title, n: num(age) }) : t("bdayTitle", { name: ev.title })));
					}
					return el("li", {}, el("span", { class: "brief-time" }, ev.start && !ev.allDay ? ev.start : t("allDay")), el("span", { dir: "auto" }, ev.title));
				}))
				: el("p", { class: "muted small" }, t("briefNoEvents"))));

		// Tasks due today or overdue
		const tasks = Store.list("todo").filter((x) => !x.done && x.due && x.due <= today).sort((a, b) => (a.due + (a.time || "")).localeCompare(b.due + (b.time || "")));
		out.push(section("✅", t("briefTasks") + (tasks.length ? " (" + num(tasks.length) + ")" : ""),
			tasks.length
				? el("ul", { class: "brief-list" }, ...tasks.slice(0, 8).map((x) =>
					el("li", { class: x.due < today ? "overdue" : "" },
						el("span", { class: "brief-time" }, x.due < today ? t("briefOverdue") : x.time || "•"),
						el("span", { dir: "auto" }, x.text))))
				: el("p", { class: "muted small" }, t("briefNoTasks")),
			tasks.length > 8 ? el("p", { class: "muted small" }, "+" + num(tasks.length - 8)) : ""));

		// Habits
		const habits = Store.list("habit");
		if (habits.length) {
			const left = habits.filter((h) => (h.log?.[today] || 0) < (h.target || 1));
			out.push(section("💧", t("wHabits"), el("p", { class: "small" }, left.length ? left.map((h) => (h.emoji || "✅") + " " + h.title).join("  ·  ") : t("briefHabitsDone"))));
		}
		// Quote
		if (H.quoteToday) {
			const [q, by] = H.quoteToday();
			out.push(el("blockquote", { class: "brief-quote", dir: "auto" }, q, by ? el("small", { class: "muted" }, " — " + by) : ""));
		}
		$("briefBody").replaceChildren(...out);
		$("briefAuto").checked = setting("briefAuto", true) !== false;
	}
	function openBrief() {
		drawBrief();
		if (!$("briefDialog").open) $("briefDialog").showModal();
		lsSet("kamyar_brief_day", dstr(new Date()));
	}
	H.openBrief = openBrief;
	$("briefBtn").addEventListener("click", openBrief);
	$("briefAuto").addEventListener("change", (e) => Store.setSetting("briefAuto", e.target.checked));
	window.addEventListener("hamyar-wx", () => $("briefDialog").open && drawBrief());

	/* ---------- focus mode ---------- */
	const DEF_SITES = ["instagram.com", "youtube.com", "x.com", "twitter.com", "facebook.com", "tiktok.com", "reddit.com"];
	let focus = { on: false, sites: DEF_SITES };
	const moved = [];
	const hasLocal = () => !!globalThis.chrome?.storage?.local;
	async function saveFocus(f) {
		focus = f;
		if (hasLocal()) await chrome.storage.local.set({ kamyar_focus: f });
		showFocus();
	}
	function move(node, into) {
		moved.push([node, node.parentNode, node.nextSibling]);
		into.append(node);
	}
	let clockTimer = 0;
	function tickClock() {
		const d = new Date();
		$("focusTime").textContent = new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
		$("focusDate").textContent = H.fmtDate(d, H.calOrder()[0]);
	}
	function drawSites() {
		$("focusSites").replaceChildren(
			...(focus.sites || []).map((s) => el("span", { class: "focus-site", dir: "ltr" }, Brands.img("https://" + s, s, 14), s,
				el("button", { type: "button", class: "icon-btn small", title: t("delete"), onclick: () => saveFocus({ ...focus, sites: focus.sites.filter((x) => x !== s) }) }, "✕")))
		);
	}
	function showFocus() {
		const on = !!focus.on;
		document.documentElement.classList.toggle("focus-on", on);
		$("focusBtn").classList.toggle("active", on);
		if (on && $("focusLayer").hidden) {
			$("focusLayer").hidden = false;
			move(document.querySelector(".search-wrap"), $("focusSearch"));
			move(document.querySelector('[data-widget="pomodoro"]'), $("focusPomo"));
			tickClock();
			clockTimer = setInterval(tickClock, 1000);
			setTimeout(() => $("searchInput").focus(), 50);
		} else if (!on && !$("focusLayer").hidden) {
			$("focusLayer").hidden = true;
			clearInterval(clockTimer);
			while (moved.length) {
				const [node, parent, next] = moved.pop();
				parent.insertBefore(node, next && next.parentNode === parent ? next : null);
			}
		}
		if (on) drawSites();
	}
	$("focusBtn").addEventListener("click", () => {
		saveFocus({ ...focus, on: !focus.on });
		if (!focus.on) return;
		toast(t("focusOnToast"));
	});
	$("focusExit").addEventListener("click", () => saveFocus({ ...focus, on: false }));
	$("focusSiteForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const s = $("focusSiteInput").value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
		if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)) return toast(t("invalidUrl"));
		if (!focus.sites.includes(s)) saveFocus({ ...focus, sites: [...focus.sites, s] });
		$("focusSiteInput").value = "";
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && focus.on && !document.querySelector("dialog[open]") && document.activeElement !== $("searchInput")) saveFocus({ ...focus, on: false });
	});
	if (hasLocal() && chrome.storage.onChanged)
		chrome.storage.onChanged.addListener((c, area) => {
			if (area === "local" && c.kamyar_focus) {
				focus = c.kamyar_focus.newValue || { on: false, sites: DEF_SITES };
				showFocus();
			}
		});

	/* ---------- expenses ---------- */
	const CATS = [["food", "🍔"], ["transport", "🚕"], ["shopping", "🛍️"], ["bills", "🧾"], ["home", "🏠"], ["fun", "🎬"], ["health", "💊"], ["edu", "📚"], ["gift", "🎁"], ["other", "📦"]];
	const CURS = ["IRT", "USD", "EUR", "CHF", "GBP", "TRY", "AED", "CAD"];
	const catOf = (id) => CATS.find((c) => c[0] === id) || CATS[CATS.length - 1];
	const toLatin = (s) => String(s).replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c)).replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/[,٬،\s]/g, "").replace(/٫/g, ".");
	function money(v, cur) {
		if (cur === "IRT") return num(Math.round(v)) + " " + t("toman");
		try {
			return new Intl.NumberFormat(I18n.locale, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(v);
		} catch {
			return num(v) + " " + cur;
		}
	}
	let monthShift = 0;
	function monthRef() {
		const cal = H.calOrder()[0];
		const d = noon();
		d.setDate(d.getDate() - (EvCore.parts(cal, d).day - 15));
		d.setTime(d.getTime() + Math.round(monthShift * 30.44) * 864e5);
		return { cal, ref: d, p: EvCore.parts(cal, d) };
	}
	function drawExpenses() {
		const { cal, ref, p } = monthRef();
		$("expMonth").textContent = new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${cal}`, { month: "long", year: "numeric" }).format(ref);
		const items = Store.list("expense").filter((x) => {
			if (!x.date) return false;
			const q = EvCore.parts(cal, new Date(x.date + "T12:00"));
			return q.year === p.year && q.month === p.month;
		}).sort((a, b) => (b.date + (b.createdAt || 0)).localeCompare(a.date + (a.createdAt || 0)));
		const byCur = {};
		for (const x of items) byCur[x.cur] = (byCur[x.cur] || 0) + Number(x.amount || 0);
		const curs = Object.keys(byCur).sort((a, b) => items.filter((x) => x.cur === b).length - items.filter((x) => x.cur === a).length);
		$("expTotals").replaceChildren(
			...(curs.length
				? curs.map((c) => el("div", { class: "exp-total" }, el("small", { class: "muted" }, t("expTotal")), el("strong", {}, money(byCur[c], c))))
				: [el("p", { class: "muted small" }, t("expEmpty"))])
		);
		// Category bars. With a budget, each capped category shows spent / cap in the budget's currency.
		const budget = setting("budget", null);
		const caps = budget && budget.caps ? Object.fromEntries(Object.entries(budget.caps).filter(([, v]) => Number(v) > 0)) : {};
		const bCur = budget && budget.cur;
		const useBudget = bCur && Object.keys(caps).length;
		const main = useBudget ? bCur : curs[0];
		const byCat = {};
		if (main) for (const x of items) if (x.cur === main) byCat[x.cat] = (byCat[x.cat] || 0) + Number(x.amount || 0);
		const catIds = [...new Set([...(useBudget ? Object.keys(caps) : []), ...Object.keys(byCat)])].sort((a, b) => (byCat[b] || 0) / (caps[b] || byCur[main] || 1) - (byCat[a] || 0) / (caps[a] || byCur[main] || 1));
		$("expCats").replaceChildren(
			...catIds.map((c) => {
				const [id, emoji] = catOf(c);
				const v = byCat[c] || 0, cap = useBudget ? Number(caps[c] || 0) : 0;
				const pct = cap ? Math.round((v / cap) * 100) : Math.round((v / (byCur[main] || 1)) * 100);
				const lvl = cap ? (pct >= 100 ? " over" : pct >= 80 ? " warn" : "") : "";
				return el("div", { class: "exp-cat" + lvl, title: cap ? t("budgetOf", { spent: money(v, main), cap: money(cap, main) }) : null },
					el("span", { class: "exp-cat-name" }, emoji + " " + t("ex_" + id)),
					el("span", { class: "exp-bar" }, el("i", { style: `width:${Math.min(100, Math.max(2, pct))}%` })),
					el("span", { class: "exp-cat-val" }, cap ? num(pct) + (I18n.lang === "fa" ? "٪" : "%") + " / " + money(cap, main).replace(/\s*(تومان|toman)$/i, "") : num(pct) + (I18n.lang === "fa" ? "٪" : "%")));
			})
		);
		const df = new Intl.DateTimeFormat(`${I18n.locale}-u-ca-${cal}`, { day: "numeric", month: "short" });
		$("expList").replaceChildren(
			...items.slice(0, 40).map((x) => {
				const [id, emoji] = catOf(x.cat);
				return el("li", { class: "exp-item" },
					el("span", { class: "exp-emoji", title: t("ex_" + id) }, emoji),
					el("span", { class: "exp-text" }, el("span", { dir: "auto" }, x.note || t("ex_" + id)), el("small", { class: "muted" }, df.format(new Date(x.date + "T12:00")))),
					el("strong", { class: "exp-amt" }, money(Number(x.amount), x.cur)),
					el("button", { type: "button", class: "icon-btn small exp-x", title: t("delete"), onclick: () => Store.remove(x.id) }, "✕"));
			})
		);
	}
	function fillExpForm() {
		const cur = setting("expCur", I18n.lang === "fa" ? "IRT" : "USD");
		$("expCur").replaceChildren(...CURS.map((c) => el("option", { value: c, selected: c === cur }, c === "IRT" ? t("toman") : c)));
		const cat = $("expCat").value || "food";
		$("expCat").replaceChildren(...CATS.map(([id, emoji]) => el("option", { value: id, selected: id === cat }, emoji + " " + t("ex_" + id))));
		if (!$("expDate").value) $("expDate").value = dstr(new Date());
	}
	$("expForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const amount = Number(toLatin($("expAmount").value));
		if (!(amount > 0)) return toast(t("expBad"));
		const cur = $("expCur").value;
		Store.add("expense", { amount, cur, cat: $("expCat").value, note: $("expNote").value.trim().slice(0, 60), date: $("expDate").value || dstr(new Date()) });
		budgetCheck($("expCat").value, cur, amount);
		if (setting("expCur") !== cur) Store.setSetting("expCur", cur);
		$("expAmount").value = "";
		$("expNote").value = "";
		$("expAmount").focus();
	});
	// Budget editor: one cap per category, in one currency.
	function drawBudget() {
		const b = setting("budget", null) || {};
		const cur = b.cur || setting("expCur", I18n.lang === "fa" ? "IRT" : "USD");
		const caps = b.caps || {};
		$("expBudget").replaceChildren(
			el("div", { class: "exp-budget-head" }, el("strong", {}, "🎯 " + t("budget")),
				el("select", { id: "budgetCur", "aria-label": "currency" }, ...CURS.map((c) => el("option", { value: c, selected: c === cur }, c === "IRT" ? t("toman") : c)))),
			el("p", { class: "muted small" }, t("budgetHint")),
			el("div", { class: "exp-budget-grid" },
				...CATS.map(([id, emoji]) => el("label", { class: "exp-budget-row" }, el("span", {}, emoji + " " + t("ex_" + id)),
					el("input", { dir: "ltr", inputmode: "decimal", "data-cat": id, value: caps[id] ? String(caps[id]) : "", placeholder: "—" })))),
			el("div", { class: "snip-actions" },
				el("button", { type: "button", class: "btn btn-ghost", onclick: () => { Store.setSetting("budget", null); $("expBudget").hidden = true; } }, t("budgetClear")),
				el("button", { type: "button", class: "btn", onclick: saveBudget }, t("save")))
		);
	}
	function saveBudget() {
		const caps = {};
		$("expBudget").querySelectorAll("input[data-cat]").forEach((i) => {
			const v = Number(toLatin(i.value));
			if (v > 0) caps[i.dataset.cat] = v;
		});
		Store.setSetting("budget", Object.keys(caps).length ? { cur: $("budgetCur").value, caps } : null);
		$("expBudget").hidden = true;
		toast(t("saved"));
	}
	$("expBudgetBtn").addEventListener("click", () => {
		$("expBudget").hidden = !$("expBudget").hidden;
		if (!$("expBudget").hidden) drawBudget();
	});
	// After adding an expense: warn at 80% and 100% of that category's cap for the current month.
	function budgetCheck(cat, cur, added) {
		const b = setting("budget", null);
		const cap = b && b.cur === cur && b.caps && Number(b.caps[cat]);
		if (!cap) return;
		const calId = H.calOrder()[0];
		const p = EvCore.parts(calId, noon());
		const spent = Store.list("expense").filter((x) => x.cur === cur && x.cat === cat && x.date && (() => { const q = EvCore.parts(calId, new Date(x.date + "T12:00")); return q.year === p.year && q.month === p.month; })()).reduce((a, x) => a + Number(x.amount || 0), 0);
		const before = spent - added;
		const name = t("ex_" + catOf(cat)[0]);
		let msg = "";
		if (spent >= cap && before < cap) msg = t("budgetOver", { cat: name, cap: money(cap, cur) });
		else if (spent >= cap * 0.8 && before < cap * 0.8) msg = t("budgetNear", { cat: name, pct: num(Math.round((spent / cap) * 100)), cap: money(cap, cur) });
		if (!msg) return;
		toast(msg);
		if (globalThis.chrome?.notifications) chrome.notifications.create("kamyar-budget-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title: "🎯 " + t("budget"), message: msg, priority: 1 });
	}
	$("expPrev").addEventListener("click", () => { monthShift--; drawExpenses(); });
	$("expNext").addEventListener("click", () => { monthShift++; drawExpenses(); });
	$("expMonth").addEventListener("click", () => { monthShift = 0; drawExpenses(); });

	H.onRefresh(() => {
		fillExpForm();
		drawExpenses();
		if ($("briefDialog").open) drawBrief();
	});
	(window.hamyarReady || Promise.resolve()).then(async () => {
		fillExpForm();
		drawExpenses();
		if (hasLocal()) {
			const { kamyar_focus: f } = await chrome.storage.local.get("kamyar_focus");
			if (f) focus = { on: !!f.on, sites: f.sites || DEF_SITES };
			showFocus();
		}
		// Morning brief: once a day, on the first new tab after 5 AM.
		const d = new Date();
		let busy = false;
		const mark = () => (busy = true);
		document.addEventListener("pointerdown", mark, { once: true, capture: true });
		document.addEventListener("keydown", mark, { once: true, capture: true });
		if (setting("briefAuto", true) !== false && d.getHours() >= 5 && lsGet("kamyar_brief_day") !== dstr(d) && !focus.on) setTimeout(() => !busy && !H.tourOpen?.() && !document.querySelector("dialog[open]") && openBrief(), 1200);
	});
})();
