/* "Services": a ready list of popular sites by category (all Google services, AI, Iranian services and more).
 * Category chips at the top jump to a section; each site opens with a click and can be added to the shortcuts.
 * Icons come from Google's public favicon service, which only sees these fixed public domains. */
(function () {
	"use strict";
	const { $, el } = H;
	const L = ["fa", "en", "fr", "de"];
	const tr = (s) => {
		const p = s.split("|");
		return p[Math.max(0, L.indexOf(I18n.lang))] || p[1] || p[0];
	};
	// [category id, emoji, names, [[title (fa|en or one name), url], ...]]
	const CATS = [
		["ai", "✨", "هوش مصنوعی|AI|IA|KI", [
			["Claude", "https://claude.ai"], ["ChatGPT", "https://chatgpt.com"], ["Qwen", "https://chat.qwen.ai"], ["DeepSeek", "https://chat.deepseek.com"], ["NotebookLM", "https://notebooklm.google.com"],
			["Gemini", "https://gemini.google.com"], ["Perplexity", "https://www.perplexity.ai"], ["Copilot", "https://copilot.microsoft.com"], ["Grok", "https://grok.com"], ["Mistral", "https://chat.mistral.ai"], ["Kimi", "https://www.kimi.ai/"], ["Hugging Face", "https://huggingface.co"]
		]],
		["aivideo", "🎥", "هوش مصنوعی ویدیو|AI video|IA vidéo|KI-Video", [
			["Sora", "https://sora.chatgpt.com"], ["Google Flow (Veo)", "https://labs.google/fx/tools/flow"], ["Runway", "https://app.runwayml.com"], ["Kling", "https://klingai.com"], ["Luma Dream Machine", "https://dream-machine.lumalabs.ai"],
			["Pika", "https://pika.art"], ["Hailuo (MiniMax)", "https://hailuoai.video"], ["PixVerse", "https://app.pixverse.ai"], ["Vidu", "https://www.vidu.com"], ["Higgsfield", "https://higgsfield.ai"],
			["Midjourney", "https://www.midjourney.com"], ["HeyGen", "https://www.heygen.com"], ["Synthesia", "https://www.synthesia.io"], ["InVideo AI", "https://invideo.io"], ["CapCut", "https://www.capcut.com"],
			["Descript", "https://www.descript.com"], ["Krea", "https://www.krea.ai"], ["Hedra", "https://www.hedra.com"]
		]],
		["google", "🔵", "سرویس‌های گوگل|Google services|Services Google|Google-Dienste", [
			["Google", "https://www.google.com"], ["Gmail", "https://mail.google.com"], ["Drive", "https://drive.google.com"], ["Docs", "https://docs.google.com/document/"], ["Sheets", "https://docs.google.com/spreadsheets/"],
			["Slides", "https://docs.google.com/presentation/"], ["Forms", "https://docs.google.com/forms/"], ["Calendar", "https://calendar.google.com"], ["Meet", "https://meet.google.com"], ["Chat", "https://chat.google.com"],
			["Keep", "https://keep.google.com"], ["Tasks", "https://tasks.google.com"], ["Contacts", "https://contacts.google.com"], ["Photos", "https://photos.google.com"], ["Maps", "https://maps.google.com"],
			["Earth", "https://earth.google.com"], ["Translate", "https://translate.google.com"], ["YouTube", "https://www.youtube.com"], ["YouTube Music", "https://music.youtube.com"], ["News", "https://news.google.com"],
			["Gemini", "https://gemini.google.com"], ["NotebookLM", "https://notebooklm.google.com"], ["Scholar", "https://scholar.google.com"], ["Books", "https://books.google.com"], ["Finance", "https://www.google.com/finance/"],
			["Flights", "https://www.google.com/travel/flights"], ["Play", "https://play.google.com"], ["Classroom", "https://classroom.google.com"], ["Sites", "https://sites.google.com"], ["Colab", "https://colab.research.google.com"],
			["Lens", "https://lens.google.com"], ["Trends", "https://trends.google.com"], ["Arts & Culture", "https://artsandculture.google.com"], ["Fonts", "https://fonts.google.com"], ["Blogger", "https://www.blogger.com"],
			["Analytics", "https://analytics.google.com"], ["Search Console", "https://search.google.com/search-console"], ["Ads", "https://ads.google.com"], ["Cloud Console", "https://console.cloud.google.com"], ["Firebase", "https://console.firebase.google.com"],
			["Google One", "https://one.google.com"], ["Passwords|Password Manager", "https://passwords.google.com"], ["حساب گوگل|Google Account", "https://myaccount.google.com"]
		]],
		["shop", "🛒", "خرید|Shopping|Achats|Einkaufen", [
			["دیجی‌کالا|Digikala", "https://www.digikala.com"], ["دیوار|Divar", "https://divar.ir"], ["ترب|Torob", "https://torob.com"], ["باسلام|Basalam", "https://basalam.com"], ["شیپور|Sheypoor", "https://www.sheypoor.com"],
			["باما|Bama", "https://bama.ir"], ["اسنپ‌فود|SnappFood", "https://snappfood.ir"], ["Amazon", "https://www.amazon.com"], ["eBay", "https://www.ebay.com"], ["AliExpress", "https://www.aliexpress.com"]
		]],
		["travel", "🧭", "سفر و مسیریابی|Travel & maps|Voyage et cartes|Reisen & Karten", [
			["اسنپ|Snapp", "https://snapp.ir"], ["تپسی|Tapsi", "https://tapsi.ir"], ["علی‌بابا|Alibaba", "https://www.alibaba.ir"], ["اسنپ‌تریپ|SnappTrip", "https://www.snapptrip.com"], ["فلای‌تودی|Flytoday", "https://www.flytoday.ir"],
			["نشان|Neshan", "https://neshan.org"], ["بلد|Balad", "https://balad.ir"], ["Google Maps", "https://maps.google.com"], ["Booking", "https://www.booking.com"], ["Airbnb", "https://www.airbnb.com"]
		]],
		["video", "🎬", "فیلم و ویدیو|Video & movies|Vidéo et films|Video & Filme", [
			["آپارات|Aparat", "https://www.aparat.com"], ["فیلیمو|Filimo", "https://www.filimo.com"], ["نماوا|Namava", "https://www.namava.ir"], ["تلوبیون|Telewebion", "https://telewebion.com"], ["فیلم‌نت|Filmnet", "https://filmnet.ir"],
			["YouTube", "https://www.youtube.com"], ["Netflix", "https://www.netflix.com"], ["Prime Video", "https://www.primevideo.com"], ["Twitch", "https://www.twitch.tv"], ["IMDb", "https://www.imdb.com"]
		]],
		["music", "🎵", "موسیقی|Music|Musique|Musik", [
			["Spotify", "https://open.spotify.com"], ["YouTube Music", "https://music.youtube.com"], ["SoundCloud", "https://soundcloud.com"], ["Apple Music", "https://music.apple.com"], ["Deezer", "https://www.deezer.com"],
			["رادیو جوان|Radio Javan", "https://www.radiojavan.com"], ["بیپ‌تونز|Beeptunes", "https://beeptunes.com"]
		]],
		["social", "💬", "شبکه‌های اجتماعی و پیام‌رسان|Social & messaging|Réseaux sociaux et messagerie|Soziale Netzwerke & Messenger", [
			["Instagram", "https://www.instagram.com"], ["X", "https://x.com"], ["Telegram", "https://web.telegram.org"], ["WhatsApp", "https://web.whatsapp.com"], ["LinkedIn", "https://www.linkedin.com"],
			["Reddit", "https://www.reddit.com"], ["Facebook", "https://www.facebook.com"], ["Threads", "https://www.threads.net"], ["Discord", "https://discord.com/app"], ["Pinterest", "https://www.pinterest.com"],
			["ایتا|Eitaa", "https://web.eitaa.com"], ["روبیکا|Rubika", "https://web.rubika.ir"]
		]],
		["news", "📰", "خبر|News|Actualités|Nachrichten", [
			["Google News", "https://news.google.com"], ["BBC فارسی|BBC Persian", "https://www.bbc.com/persian"], ["ایسنا|ISNA", "https://www.isna.ir"], ["ایرنا|IRNA", "https://www.irna.ir"], ["خبرآنلاین|Khabaronline", "https://www.khabaronline.ir"],
			["ورزش سه|Varzesh3", "https://www.varzesh3.com"], ["زومیت|Zoomit", "https://www.zoomit.ir"], ["BBC News", "https://www.bbc.com/news"], ["Reuters", "https://www.reuters.com"], ["Euronews", "https://www.euronews.com"]
		]],
		["usnews", "🇺🇸", "خبرگزاری‌های آمریکا|US news|Presse américaine|US-Nachrichten", [
			["Reuters", "https://www.reuters.com"], ["AP News", "https://apnews.com"], ["CNN", "https://www.cnn.com"], ["The New York Times", "https://www.nytimes.com"], ["The Washington Post", "https://www.washingtonpost.com"],
			["The Wall Street Journal", "https://www.wsj.com"], ["Bloomberg", "https://www.bloomberg.com"], ["NPR", "https://www.npr.org"], ["NBC News", "https://www.nbcnews.com"], ["ABC News", "https://abcnews.go.com"],
			["CBS News", "https://www.cbsnews.com"], ["Fox News", "https://www.foxnews.com"], ["CNBC", "https://www.cnbc.com"], ["USA Today", "https://www.usatoday.com"], ["Politico", "https://www.politico.com"], ["Axios", "https://www.axios.com"]
		]],
		["gaming", "🎮", "گیمینگ|Gaming|Jeux vidéo|Gaming", [
			["Steam", "https://store.steampowered.com"], ["Epic Games", "https://store.epicgames.com"], ["PlayStation", "https://www.playstation.com"], ["Xbox", "https://www.xbox.com"], ["Nintendo", "https://www.nintendo.com"],
			["GOG", "https://www.gog.com"], ["itch.io", "https://itch.io"], ["Battle.net", "https://battle.net"], ["EA", "https://www.ea.com"], ["Ubisoft", "https://www.ubisoft.com"], ["Rockstar Games", "https://www.rockstargames.com"],
			["Twitch", "https://www.twitch.tv"], ["IGN", "https://www.ign.com"], ["GameSpot", "https://www.gamespot.com"], ["Metacritic", "https://www.metacritic.com/game/"], ["PC Gamer", "https://www.pcgamer.com"],
			["Kotaku", "https://kotaku.com"], ["HowLongToBeat", "https://howlongtobeat.com"], ["زومجی|Zoomg", "https://www.zoomg.ir"], ["گیمفا|Gamefa", "https://gamefa.com"]
		]],
		["wallpapers", "🖼️", "والپیپر|Wallpapers|Fonds d'écran|Hintergrundbilder", [
			["Wallhaven", "https://wallhaven.cc"], ["Wallpaper Abyss", "https://wall.alphacoders.com"], ["Wallpaper Cave", "https://wallpapercave.com"], ["WallpapersCraft", "https://wallpaperscraft.com"],
			["HDQwalls", "https://hdqwalls.com"], ["GameWallpapers", "https://www.gamewallpapers.com"], ["DeviantArt", "https://www.deviantart.com/topic/wallpaper"], ["Unsplash", "https://unsplash.com/wallpapers"],
			["Pexels", "https://www.pexels.com"], ["WallpaperAccess", "https://wallpaperaccess.com"], ["Wallpaper Flare", "https://www.wallpaperflare.com"]
		]],
		["tools", "🧰", "ابزارهای آنلاین|Online tools|Outils en ligne|Online-Werkzeuge", [
			["Google Translate", "https://translate.google.com"], ["ویکی‌پدیا|Wikipedia", "https://www.wikipedia.org"], ["Speedtest", "https://www.speedtest.net"], ["Fast.com", "https://fast.com"], ["iLovePDF", "https://www.ilovepdf.com"],
			["remove.bg", "https://www.remove.bg"], ["Canva", "https://www.canva.com"], ["TinyPNG", "https://tinypng.com"], ["Convertio", "https://convertio.co"], ["VirusTotal", "https://www.virustotal.com"]
		]],
		["dev", "☁️", "فضای ابری و برنامه‌نویسی|Cloud & developers|Cloud et développeurs|Cloud & Entwickler", [
			["GitHub", "https://github.com"], ["GitLab", "https://gitlab.com"], ["Stack Overflow", "https://stackoverflow.com"], ["Vercel", "https://vercel.com"], ["Netlify", "https://app.netlify.com"],
			["Cloudflare", "https://dash.cloudflare.com"], ["AWS", "https://console.aws.amazon.com"], ["Azure", "https://portal.azure.com"], ["ابر آروان|ArvanCloud", "https://panel.arvancloud.ir"], ["لیارا|Liara", "https://liara.ir"],
			["Dropbox", "https://www.dropbox.com"], ["OneDrive", "https://onedrive.live.com"], ["MEGA", "https://mega.nz"]
		]],
		["learn", "🎓", "آموزش|Learning|Apprendre|Lernen", [
			["Coursera", "https://www.coursera.org"], ["Udemy", "https://www.udemy.com"], ["Khan Academy", "https://www.khanacademy.org"], ["edX", "https://www.edx.org"], ["Duolingo", "https://www.duolingo.com"],
			["فرادرس|Faradars", "https://faradars.org"], ["مکتب‌خونه|Maktabkhooneh", "https://maktabkhooneh.org"]
		]]
	];
	const icon = (url) => "https://www.google.com/s2/favicons?sz=64&domain_url=" + encodeURIComponent(url);
	H.siteImg = (url, name, size) => Brands.img(url, name, size);
	H.siteIcon = icon;

	/* ---------- categories: built-in, Iranian, and the user's own; each can be turned off ---------- */
	const custom = () => H.setting("svcCustom", []) || [];
	const off = () => H.setting("svcOff", {}) || {};
	const setOff = (id, hidden) => Store.setSetting("svcOff", { ...off(), [id]: hidden });
	const saveCustom = (list) => Store.setSetting("svcCustom", list);
	// Everything as [id, emoji, name, items, isCustom]; custom items are {title, url}.
	function all() {
		return H.byOrder([
			...CATS.map((c) => [c[0], c[1], tr(c[2]), c[3].map(([title, url]) => ({ title: tr(title), url })), false, "world"]),
			...(window.SERVICES_IR || []).map((c) => [c[0], c[1], tr(c[2]), c[3].map(([title, url]) => ({ title: tr(title), url })), false, "iran"]),
			...custom().map((c) => [c.id, c.emoji || "📁", c.title, c.items || [], true, "mine"])
		], H.setting("svcOrder", []), (c) => c[0]);
	}
	const normUrl = (u) => {
		u = u.trim();
		if (!u) return "";
		if (!/^https?:\/\//i.test(u)) u = "https://" + u;
		try { return new URL(u).href; } catch { return ""; }
	};
	const sameUrl = (a, b) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

	function tile(item, cat) {
		const { title: name, url } = item;
		return el("li", { class: "app" },
			el("a", { href: url, title: url },
				H.siteImg(url, name, 32),
				el("span", { class: "app-name", dir: "auto" }, name)),
			el("button", { class: "app-add", type: "button", title: t("addToShortcuts"), "aria-label": t("addToShortcuts") + ": " + name, onclick: () => {
				if (Store.list("bookmark").some((b) => sameUrl(b.url, url))) return H.toast(t("alreadyShortcut"));
				Store.add("bookmark", { title: name, url });
				H.toast(t("addedShortcut", { name }));
			} }, "+"),
			cat[4] ? el("button", { class: "app-del", type: "button", title: t("delete"), "aria-label": t("delete") + ": " + name, onclick: () => {
				saveCustom(custom().map((c) => (c.id === cat[0] ? { ...c, items: c.items.filter((x) => !sameUrl(x.url, url)) } : c)));
			} }, "✕") : null);
	}
	function addSiteForm(cat) {
		const name = el("input", { type: "text", placeholder: t("svcSiteName"), required: true, maxlength: 60 });
		const url = el("input", { type: "text", placeholder: "example.com", required: true, dir: "ltr" });
		return el("form", { class: "svc-add-site", hidden: true, onsubmit: (e) => {
			e.preventDefault();
			const u = normUrl(url.value);
			if (!u) return H.toast(t("svcBadUrl"));
			saveCustom(custom().map((c) => (c.id === cat[0] ? { ...c, items: [...(c.items || []), { title: name.value.trim() || new URL(u).hostname, url: u }] } : c)));
		} }, name, url, el("button", { class: "btn", type: "submit" }, t("add")));
	}
	function section(cat) {
		const [id, emoji, name, items, mine] = cat;
		const form = mine ? addSiteForm(cat) : null;
		return el("section", { class: "card apps-sec" + (mine ? " mine" : ""), id: "apps-" + id, "data-key": id },
			el("h2", { class: "apps-h" }, query ? null : H.dragHandle(), el("span", {}, emoji), el("span", { dir: "auto" }, name),
				el("span", { class: "grow" }),
				mine ? el("button", { class: "chip svc-plus", type: "button", onclick: () => { form.hidden = !form.hidden; if (!form.hidden) form.querySelector("input").focus(); } }, "＋ ", t("svcAddSite")) : null,
				el("button", { class: "icon-btn small svc-hide", type: "button", title: t("svcHide"), "aria-label": t("svcHide"), onclick: () => {
					setOff(id, true);
					H.toast(t("svcHidden", { name }), { run: () => setOff(id, false) });
				} }, "✕")),
			form,
			items.length ? el("ul", { class: "apps-grid" }, ...items.map((it) => tile(it, cat))) : el("p", { class: "muted small" }, t("svcEmpty")));
	}

	/* ---------- manage dialog ---------- */
	function drawManage() {
		const hidden = off();
		$("svcList").replaceChildren(...all().map((c) =>
			el("label", { class: "manage-item" + (hidden[c[0]] ? "" : " on"), "data-key": c[0], for: "svcOn-" + c[0] },
				el("span", { class: "drag-h", tabindex: "0", role: "button", title: t("boxMove"), "aria-label": t("boxMove"), onclick: (e) => e.preventDefault() }, "⠿"),
				el("span", { class: "manage-ic" }, c[1]),
				el("span", { class: "manage-name", dir: "auto" }, c[2]),
				c[4] ? el("button", { class: "icon-btn small", type: "button", title: t("delete"), onclick: (e) => {
					e.preventDefault();
					const keep = custom();
					saveCustom(keep.filter((x) => x.id !== c[0]));
					H.toast(t("svcDeleted", { name: c[2] }), { run: () => saveCustom(keep) });
				} }, "🗑") : null,
				el("input", { type: "checkbox", class: "switch", id: "svcOn-" + c[0], checked: !hidden[c[0]], onchange: (e) => setOff(c[0], !e.target.checked) }))));
	}
	function openManage() {
		drawManage();
		$("svcDialog").showModal();
	}
	$("svcNewForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const title = $("svcNewName").value.trim();
		if (!title) return;
		const id = "my-" + Date.now().toString(36);
		saveCustom([...custom(), { id, title, emoji: $("svcNewEmoji").value.trim() || "📁", items: [] }]);
		$("svcNewName").value = "";
		$("svcNewEmoji").value = "";
		$("svcDialog").close();
		group = "mine";
		ls("kamyar_svc_group", "mine");
		drawnKey = null;
		render();
		setTimeout(() => { const s = $("apps-" + id); if (s) { s.scrollIntoView({ behavior: "smooth", block: "start" }); s.querySelector(".svc-plus")?.click(); } }, 200);
	});
	// New order of some categories (one group, or the whole list in the dialog), written into the full order.
	function saveOrder(ids) {
		const full = all().map((c) => c[0]);
		const set = new Set(ids);
		let i = 0;
		const next = full.map((id) => (set.has(id) ? ids[i++] : id));
		if (String(next) !== String(full)) Store.setSetting("svcOrder", next);
	}
	H.sortable($("svcList"), ".manage-item", saveOrder);
	$("svcAllOn").addEventListener("click", () => { Store.setSetting("svcOff", {}); });
	$("svcDialog").addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === $("svcDialog")) $("svcDialog").close(); });

	/* ---------- top bar: group tabs (world / Iranian / mine), search, one row of category chips ---------- */
	const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
	const GROUPS = [["world", "🌍", "svcWorld"], ["iran", "🇮🇷", "svcIran"], ["mine", "⭐", "svcMine"]];
	let group = ls("kamyar_svc_group") || (I18n.lang === "fa" ? "iran" : "world");
	let query = "";
	const fold = (x) => x.toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ");

	function body() {
		const hidden = off();
		let cats = all().filter((c) => !hidden[c[0]]);
		if (query) {
			const q = fold(query);
			cats = cats.map((c) => [...c.slice(0, 3), c[3].filter((it) => fold(it.title + " " + it.url).includes(q)), ...c.slice(4)]).filter((c) => c[3].length);
			$("svcChips").replaceChildren();
			return cats.length ? cats.map(section) : [el("p", { class: "muted apps-none" }, t("svcNoMatch"))];
		}
		cats = cats.filter((c) => c[5] === group);
		$("svcChips").replaceChildren(...cats.map(([id, emoji, name]) =>
			el("button", { type: "button", class: "apps-chip", onclick: () => $("apps-" + id).scrollIntoView({ behavior: "smooth", block: "start" }) }, emoji, " ", name)));
		if (group === "mine" && !cats.length) return [el("div", { class: "card apps-sec apps-empty" }, el("p", {}, t("svcMineEmpty")), el("button", { class: "btn", type: "button", onclick: openManage }, "＋ ", t("svcNew")))];
		return cats.map(section);
	}
	function drawBody() {
		$("svcBody").replaceChildren(...body());
		document.querySelectorAll(".svc-tab").forEach((b) => b.classList.toggle("on", !query && b.dataset.g === group));
	}

	let drawnKey = null;
	// Built only when the Services page is open: it is the largest page and most new tabs never show it.
	function render() {
		if ($("svcDialog").open) drawManage();
		const key = JSON.stringify([I18n.lang, off(), custom(), H.setting("svcOrder", []), H.setting("svcCols", 1)]);
		if (drawnKey === key || $("viewApps").hidden) return;
		drawnKey = key;
		const view = $("viewApps");
		const top = view.scrollTop;
		const search = el("input", { type: "search", class: "svc-search", placeholder: t("svcSearch"), value: query, oninput: (e) => { query = e.target.value.trim(); drawBody(); } });
		const bar = el("div", { class: "apps-top" },
			el("div", { class: "svc-tabs", role: "tablist" }, ...GROUPS.map(([g, emoji, label]) =>
				el("button", { type: "button", class: "svc-tab", role: "tab", "data-g": g, onclick: () => { group = g; ls("kamyar_svc_group", g); query = ""; search.value = ""; drawBody(); view.scrollTop = 0; } }, emoji, " ", t(label)))),
			search,
			el("div", { class: "seg svc-cols", role: "group", title: t("layoutCols") }, ...[[1, "▤"], [2, "▥"]].map(([n, ic]) =>
				el("button", { type: "button", class: "seg-btn" + ((H.setting("svcCols", 1) || 1) === n ? " active" : ""), title: t("layoutCols") + ": " + H.num(n), "aria-label": t("layoutCols") + ": " + H.num(n), onclick: () => Store.setSetting("svcCols", n) }, ic))),
			el("button", { type: "button", class: "icon-btn svc-manage", title: t("svcManage"), "aria-label": t("svcManage"), onclick: openManage }, "⚙️"));
		view.replaceChildren(el("div", { class: "apps-head" }, bar, el("nav", { id: "svcChips", class: "apps-chips" })), el("div", { id: "svcBody", class: "apps-body" + ((H.setting("svcCols", 1) || 1) === 2 ? " two" : "") }));
		H.sortable($("svcBody"), ".apps-sec[data-key]", saveOrder);
		drawBody();
		view.scrollTop = top;
	}
	H.svcGroup = (g) => { group = g; drawBody(); };
	H.openServicesManage = () => { H.showView?.("apps"); openManage(); };

	H.onRefresh(render);
	window.Services = { render, CATS, all };
})();
