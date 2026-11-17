importScripts("i18n-bg.js", "events-core.js");

// Clicking the toolbar icon opens a new tab (the Kamyar page).
chrome.action.onClicked.addListener(() => chrome.tabs.create({}));

// Pomodoro: finish the session when its alarm fires, even if no new tab is open.
const POMO = "hamyar_pomo";
const MIN = 60000;
const DUR = { focus: 25 * MIN, short: 5 * MIN, long: 15 * MIN };

chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== "hamyar-pomo") return;
	const s = (await chrome.storage.local.get(POMO))[POMO];
	if (!s || !s.running) return;
	const today = new Date().toDateString();
	let count = s.countDate === today ? s.count || 0 : 0;
	let next;
	if (s.mode === "focus") {
		count += 1;
		next = count % 4 === 0 ? "long" : "short";
	} else next = "focus";
	await chrome.storage.local.set({ [POMO]: { ...s, running: false, mode: next, remaining: DUR[next], count, countDate: today } });
	const t = await bgT();
	const title = s.mode === "focus" ? t("notifFocusDone") : t("notifBreakDone");
	const message = s.mode === "focus" ? t("notifBreakNext", { m: next === "long" ? 15 : 5 }) : t("notifFocusNext");
	chrome.notifications.create("hamyar-pomo-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title, message, priority: 2 });
});

// Task reminders: the new-tab page schedules an alarm "todo:<id>" for each task with a reminder.
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (!alarm.name.startsWith("todo:")) return;
	const id = alarm.name.slice(5);
	const data = (await chrome.storage.local.get("hamyar_data")).hamyar_data;
	const x = data && data.items && data.items[id];
	if (!x || x.deleted || x.done) return;
	const t = await bgT();
	chrome.notifications.create("hamyar-todo-" + id + "-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title: t("notifTask"), message: String(x.text || "").slice(0, 200) + (x.desc ? "\n" + String(x.desc).slice(0, 200) : ""), priority: 2 });
});
// Personal events and birthdays: notify, then schedule the next occurrence of a repeating event.
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (!alarm.name.startsWith("ev:")) return;
	const id = alarm.name.slice(3);
	const data = (await chrome.storage.local.get("hamyar_data")).hamyar_data;
	const ev = data && data.items && data.items[id];
	if (!ev || ev.deleted) return;
	const t = await bgT();
	const days = Math.round(Number(ev.remind || 0) / 1440);
	const when = days <= 0 ? t("whenToday") : days === 1 ? t("whenTomorrow") : t("whenInDays", { n: days });
	const occ = new Date(Date.now() + Number(ev.remind || 0) * 60000);
	occ.setHours(12, 0, 0, 0);
	let title, message;
	if (ev.kind === "birthday") {
		const age = EvCore.ageOn(ev, occ);
		title = age > 0 ? t("notifBirthdayAge", { name: ev.title, n: age }) : t("notifBirthday", { name: ev.title });
		message = when;
	} else {
		title = t("notifEvent");
		message = String(ev.title || "").slice(0, 200) + "\n" + when + (ev.start && !ev.allDay ? " · " + ev.start : "");
	}
	chrome.notifications.create("hamyar-ev-" + id + "-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title, message, priority: 2 });
	const next = EvCore.nextFire(ev, Date.now() + 60000);
	if (next) chrome.alarms.create(alarm.name, { when: next.when });
});
// Countdown timer from the tools widget.
chrome.alarms.onAlarm.addListener(async (alarm) => {
	if (alarm.name !== "hamyar-timer") return;
	await chrome.storage.local.set({ hamyar_timer: { running: false, remaining: 0, total: 0, endAt: 0 } });
	const t = await bgT();
	chrome.notifications.create("hamyar-timer-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title: t("notifTimer"), message: t("notifTimerMsg"), priority: 2, requireInteraction: true });
});
chrome.notifications.onClicked.addListener((nid) => {
	if (nid.startsWith("hamyar-")) chrome.tabs.create({});
});

// Right-click menu: "Save to Read later". The link waits in local storage until a Kamyar tab picks it up.
const LATER_TITLE = { fa: "ذخیره در «بعداً بخوانم» کامیار", en: "Save to Kamyar Read later", fr: "Enregistrer dans Kamyar · À lire plus tard", de: "In Kamyar · Später lesen speichern" };
const SNIP_TITLE = { fa: "قطعه‌متن‌های کامیار", en: "Kamyar snippets", fr: "Extraits Kamyar", de: "Kamyar-Textbausteine" };
const snippetsOf = (data) => Object.values((data && data.items) || {}).filter((x) => x && x.type === "snippet" && !x.deleted).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, 30);
let menuSig = "";
async function setupMenu(force) {
	const { hamyar_lang: lang, hamyar_data: data } = await chrome.storage.local.get(["hamyar_lang", "hamyar_data"]);
	const snips = snippetsOf(data);
	const sig = (lang || "") + "|" + snips.map((x) => x.id + ":" + x.title).join(",");
	if (sig === menuSig && !force) return;
	menuSig = sig;
	chrome.contextMenus.removeAll(() => {
		chrome.contextMenus.create({ id: "kamyar-later", title: LATER_TITLE[lang] || LATER_TITLE.fa, contexts: ["page", "link"] });
		if (!snips.length) return;
		chrome.contextMenus.create({ id: "kamyar-snip", title: SNIP_TITLE[lang] || SNIP_TITLE.fa, contexts: ["editable"] });
		for (const x of snips) chrome.contextMenus.create({ id: "snip:" + x.id, parentId: "kamyar-snip", title: String(x.title || x.text || "").slice(0, 60).replace(/&/g, "&&"), contexts: ["editable"] });
	});
}
chrome.runtime.onInstalled.addListener(() => setupMenu(true));
chrome.runtime.onStartup.addListener(() => setupMenu(true));
chrome.storage.onChanged.addListener((c, area) => area === "local" && (c.hamyar_lang || c.hamyar_data) && setupMenu());
// Puts a snippet's text where the cursor is, in the page the person right-clicked.
function insertSnippet(text) {
	const el = document.activeElement;
	if (el && (el.tagName === "TEXTAREA" || (el.tagName === "INPUT" && /^(text|search|email|url|tel|)$/i.test(el.type)))) {
		const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? el.value.length;
		el.setRangeText(text, a, b, "end");
		el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
		return true;
	}
	if (el && el.isContentEditable) return document.execCommand("insertText", false, text);
	return false;
}
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
	if (String(info.menuItemId).startsWith("snip:")) {
		const id = String(info.menuItemId).slice(5);
		const { hamyar_data: data } = await chrome.storage.local.get("hamyar_data");
		const x = data && data.items && data.items[id];
		if (!x || x.deleted || !tab) return;
		try {
			await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [info.frameId || 0] }, func: insertSnippet, args: [String(x.text || "")] });
		} catch {}
		return;
	}
	if (info.menuItemId !== "kamyar-later") return;
	const url = info.linkUrl || info.pageUrl;
	if (!/^https?:/i.test(url || "")) return;
	const title = info.linkUrl ? info.selectionText || "" : (tab && tab.title) || "";
	const { kamyar_inbox: box = [] } = await chrome.storage.local.get("kamyar_inbox");
	box.push({ url, title: String(title).slice(0, 200) });
	await chrome.storage.local.set({ kamyar_inbox: box.slice(-200) });
});

// Focus mode: while it is on, the sites the person listed are blocked with declarativeNetRequest.
async function applyFocus() {
	const { kamyar_focus: f } = await chrome.storage.local.get("kamyar_focus");
	const old = await chrome.declarativeNetRequest.getDynamicRules();
	const removeRuleIds = old.filter((r) => r.id >= 9000 && r.id < 9100).map((r) => r.id);
	const sites = f && f.on ? (f.sites || []).map((s) => String(s).toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]).filter((s) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)).slice(0, 60) : [];
	const addRules = sites.map((s, i) => ({ id: 9000 + i, priority: 1, action: { type: "block" }, condition: { urlFilter: "||" + s, resourceTypes: ["main_frame"] } }));
	await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds, addRules });
}
chrome.storage.onChanged.addListener((c, area) => area === "local" && c.kamyar_focus && applyFocus());
chrome.runtime.onStartup.addListener(applyFocus);
chrome.runtime.onInstalled.addListener(applyFocus);

// Focus sounds: an offscreen document plays the mix so it continues in every tab.
const SOUNDS = "kamyar_sounds";
async function soundsState() {
	return (await chrome.storage.local.get(SOUNDS))[SOUNDS] || null;
}
async function hasOffscreen() {
	if (!chrome.runtime.getContexts) return false;
	const c = await chrome.runtime.getContexts({ contextTypes: ["OFFSCREEN_DOCUMENT"] });
	return c.length > 0;
}
let offscreenBusy = null;
async function applySounds() {
	const s = await soundsState();
	const on = !!(s && s.playing && Object.values(s.mix || {}).some((v) => v > 0));
	if (on) {
		if (!(await hasOffscreen())) {
			offscreenBusy ||= chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "Play the focus sounds the person chose (rain, cafe, noise) while they browse." }).catch(() => {});
			await offscreenBusy;
			offscreenBusy = null;
		}
		chrome.runtime.sendMessage({ target: "kamyar-offscreen", type: "sounds", state: s }).catch(() => {});
		if (s.endAt && s.endAt > Date.now()) chrome.alarms.create("kamyar-sounds-end", { when: s.endAt });
		else chrome.alarms.clear("kamyar-sounds-end");
	} else {
		chrome.alarms.clear("kamyar-sounds-end");
		if (await hasOffscreen()) {
			chrome.runtime.sendMessage({ target: "kamyar-offscreen", type: "sounds", state: s }).catch(() => {});
			// Let the sound fade out, then close the document.
			setTimeout(async () => {
				const now = await soundsState();
				if (!(now && now.playing) && (await hasOffscreen())) chrome.offscreen.closeDocument().catch(() => {});
			}, 1600);
		}
	}
}
chrome.storage.onChanged.addListener((c, area) => {
	if (area !== "local") return;
	if (c[SOUNDS]) applySounds();
	// Focus mode can start and stop the sounds with it.
	if (c.kamyar_focus) {
		const was = c.kamyar_focus.oldValue && c.kamyar_focus.oldValue.on, now = c.kamyar_focus.newValue && c.kamyar_focus.newValue.on;
		if (was === now) return;
		soundsState().then((s) => {
			if (!s || s.auto === false || !Object.values(s.mix || {}).some((v) => v > 0)) return;
			// Start with focus; on leaving focus, stop only what focus mode started.
			if (now && !s.playing) chrome.storage.local.set({ [SOUNDS]: { ...s, playing: true, byFocus: true, endAt: 0 } });
			else if (!now && s.playing && s.byFocus) chrome.storage.local.set({ [SOUNDS]: { ...s, playing: false, byFocus: false } });
		});
	}
});
chrome.runtime.onMessage.addListener((m, _sender, reply) => {
	if (m && m.type === "kamyar-sounds-get") {
		soundsState().then(reply);
		return true;
	}
	if (m && m.type === "kamyar-alerts-check") {
		checkAlerts().then(() => reply(true), () => reply(false));
		return true;
	}
});
chrome.runtime.onStartup.addListener(async () => {
	// Sounds never start by themselves when Chrome opens.
	const s = await soundsState();
	if (s && s.playing) chrome.storage.local.set({ [SOUNDS]: { ...s, playing: false } });
});

// Price alerts: checked every 5 minutes; each alert fires once until it is re-armed on the new-tab page.
const ALERT_STR = {
	fa: { title: "🔔 هشدار قیمت", below: "{name} به {price} رسید (زیر {target})", above: "{name} به {price} رسید (بالای {target})" },
	en: { title: "🔔 Price alert", below: "{name} is at {price} (below {target})", above: "{name} is at {price} (above {target})" },
	fr: { title: "🔔 Alerte de prix", below: "{name} est à {price} (sous {target})", above: "{name} est à {price} (au-dessus de {target})" },
	de: { title: "🔔 Preisalarm", below: "{name} steht bei {price} (unter {target})", above: "{name} steht bei {price} (über {target})" }
};
const NAVASAN_FIELDS = ["usd_sell", "eur", "gbp", "aed", "try", "18ayar", "sekkeh", "bahar", "nim", "rob", "usdt"];
async function priceOf(assets, navKey) {
	const out = {};
	const coins = assets.filter((a) => a.startsWith("c:")).map((a) => a.slice(2));
	if (coins.length) {
		try {
			const d = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${[...new Set(coins)].join(",")}&vs_currencies=usd`)).json();
			for (const c of coins) if (d[c] && d[c].usd != null) out["c:" + c] = d[c].usd;
		} catch {}
	}
	for (const a of assets.filter((x) => x.startsWith("s:"))) {
		try {
			const d = await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(a.slice(2))}?range=1d&interval=1d`)).json();
			const m = d.chart.result[0].meta;
			if (m.regularMarketPrice != null) out[a] = m.regularMarketPrice;
		} catch {}
	}
	if (navKey && assets.some((a) => a.startsWith("ir:"))) {
		try {
			const d = await (await fetch(`https://api.navasan.tech/latest/?api_key=${encodeURIComponent(navKey)}`)).json();
			for (const f of NAVASAN_FIELDS) if (d[f] && d[f].value != null) out["ir:" + f] = Number(String(d[f].value).replace(/,/g, ""));
		} catch {}
	}
	return out;
}
async function checkAlerts() {
	const { hamyar_data: data, kamyar_alert_fired: fired = {}, hamyar_lang: lang } = await chrome.storage.local.get(["hamyar_data", "kamyar_alert_fired", "hamyar_lang"]);
	const alerts = Object.values((data && data.items) || {}).filter((x) => x && x.type === "alert" && !x.deleted && x.asset && Number(x.value) > 0);
	if (!alerts.length) return;
	const prices = await priceOf([...new Set(alerts.map((x) => x.asset))], data.settings && data.settings.navasanKey);
	const S = ALERT_STR[lang] || ALERT_STR.fa;
	const fmt = (v, ir) => new Intl.NumberFormat(lang === "fa" ? "fa-IR" : lang || "en", ir ? { maximumFractionDigits: 0 } : { style: "currency", currency: "USD", maximumFractionDigits: v < 10 ? 4 : 2 }).format(v) + (ir ? (lang === "fa" ? " تومان" : " IRT") : "");
	const changed = { ...fired };
	for (const x of alerts) {
		const p = prices[x.asset];
		if (p == null) continue;
		const hit = x.op === "<" ? p <= Number(x.value) : p >= Number(x.value);
		if (hit && !fired[x.id]) {
			const ir = x.asset.startsWith("ir:");
			changed[x.id] = { at: Date.now(), price: p };
			chrome.notifications.create("kamyar-alert-" + x.id + "-" + Date.now(), { type: "basic", iconUrl: "icons/icon-128.png", title: S.title, message: S[x.op === "<" ? "below" : "above"].replace("{name}", x.name || x.asset).replace("{price}", fmt(p, ir)).replace("{target}", fmt(Number(x.value), ir)), priority: 2 });
		}
	}
	await chrome.storage.local.set({ kamyar_alert_fired: changed, kamyar_alert_last: { at: Date.now(), prices } });
}
chrome.alarms.onAlarm.addListener((a) => {
	if (a.name === "kamyar-alerts") checkAlerts();
	if (a.name === "kamyar-sounds-end") soundsState().then((s) => s && chrome.storage.local.set({ [SOUNDS]: { ...s, playing: false, endAt: 0 } }));
});
const ensureAlertAlarm = () => chrome.alarms.get("kamyar-alerts", (a) => !a && chrome.alarms.create("kamyar-alerts", { periodInMinutes: 5, delayInMinutes: 1 }));
chrome.runtime.onInstalled.addListener(ensureAlertAlarm);
chrome.runtime.onStartup.addListener(ensureAlertAlarm);
