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
			["Gemini", "https://gemini.google.com"], ["Perplexity", "https://www.perplexity.ai"], ["Copilot", "https://copilot.microsoft.com"], ["Grok", "https://grok.com"], ["Mistral", "https://chat.mistral.ai"], ["Hugging Face", "https://huggingface.co"]
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
		["iran", "🇮🇷", "خدمات ایرانی|Iranian services|Services iraniens|Iranische Dienste", [
			["دولت من|My Gov", "https://my.gov.ir"], ["خدمات قضایی (ثنا)|Judiciary e-services", "https://adliran.ir"], ["پلیس+|Police+", "https://epolice.ir"], ["سامانه مالیاتی|Tax portal", "https://my.tax.gov.ir"],
			["سجام|Sejam", "https://sejam.ir"], ["تأمین اجتماعی|Social Security", "https://es.tamin.ir"], ["پست|Iran Post", "https://post.ir"], ["شاپرک|Shaparak", "https://shaparak.ir"],
			["بانک مرکزی|Central Bank", "https://www.cbi.ir"], ["همراه اول من|My MCI", "https://my.mci.ir"], ["ایرانسل من|My Irancell", "https://my.irancell.ir"], ["تقویم time.ir|time.ir calendar", "https://www.time.ir"]
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

	let drawnLang = null;
	function render() {
		if (drawnLang === I18n.lang) return;
		drawnLang = I18n.lang;
		const view = $("viewApps");
		const sections = CATS.map(([id, emoji, names, items]) =>
			el("section", { class: "card apps-sec", id: "apps-" + id },
				el("h2", { class: "apps-h" }, el("span", {}, emoji), tr(names)),
				el("ul", { class: "apps-grid" }, ...items.map(([title, url]) => {
					const name = tr(title);
					return el("li", { class: "app" },
						el("a", { href: url, title: url },
							H.siteImg(url, name, 32),
							el("span", { class: "app-name", dir: "auto" }, name)),
						el("button", { class: "app-add", type: "button", title: t("addToShortcuts"), "aria-label": t("addToShortcuts") + ": " + name, onclick: () => {
							if (Store.list("bookmark").some((b) => b.url.replace(/\/$/, "") === url.replace(/\/$/, ""))) return H.toast(t("alreadyShortcut"));
							Store.add("bookmark", { title: name, url });
							H.toast(t("addedShortcut", { name }));
						} }, "+"));
				})))
		);
		const chips = el("nav", { class: "apps-chips" }, ...CATS.map(([id, emoji, names]) =>
			el("button", { type: "button", class: "apps-chip", onclick: () => $("apps-" + id).scrollIntoView({ behavior: "smooth", block: "start" }) }, tr(names), " ", emoji)));
		view.replaceChildren(chips, el("div", { class: "apps-body" }, ...sections));
	}
	H.onRefresh(render);
	window.Services = { render, CATS };
})();
