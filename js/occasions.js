/* Occasions for any day, each with its own emoji: Iranian official holidays and national days
 * (Persian solar calendar), Islamic occasions (lunar calendar, Umm al-Qura, may differ by a day from Iran's
 * official announcement), and international days (Gregorian). Names: fa|en|fr|de; an empty part falls back to English. */
(function () {
	"use strict";
	const L = ["fa", "en", "fr", "de"];
	const name = (s) => {
		const p = s.split("|");
		const i = Math.max(0, L.indexOf(I18n.lang));
		return p[i] || p[1];
	};
	// [month, day, emoji, names, holiday (1/0), category]
	const SOLAR = [
		[1, 1, "🌱", "عید نوروز|Nowruz (Persian New Year)|Norouz (Nouvel An persan)|Nouruz (persisches Neujahr)", 1, "national"],
		[1, 2, "🌱", "عید نوروز|Nowruz holiday|Norouz|Nouruz", 1, "national"],
		[1, 3, "🌱", "عید نوروز|Nowruz holiday|Norouz|Nouruz", 1, "national"],
		[1, 4, "🌱", "عید نوروز|Nowruz holiday|Norouz|Nouruz", 1, "national"],
		[1, 12, "🇮🇷", "روز جمهوری اسلامی|Islamic Republic Day", 1, "state"],
		[1, 13, "🌳", "روز طبیعت (سیزده‌به‌در)|Nature Day (Sizdah Bedar)|Journée de la nature (Sizdah Bedar)|Tag der Natur (Sizdah Bedar)", 1, "national"],
		[1, 25, "📜", "روز بزرگداشت عطار نیشابوری|Attar of Nishapur Day", 0, "arts"],
		[2, 1, "📜", "روز بزرگداشت سعدی|Saadi Day|Journée de Saadi|Saadi-Tag", 0, "arts"],
		[2, 3, "🏛️", "روز بزرگداشت شیخ بهایی و روز معمار|Sheikh Baha'i Day (Architects' Day)", 0, "work"],
		[2, 10, "🌊", "روز ملی خلیج فارس|National Persian Gulf Day|Journée nationale du golfe Persique|Nationaler Tag des Persischen Golfs", 0, "national"],
		[2, 12, "👩‍🏫", "روز معلم|Teachers' Day (Iran)|Journée des enseignants (Iran)|Lehrertag (Iran)", 0, "work"],
		[2, 25, "📖", "روز بزرگداشت فردوسی و پاسداشت زبان فارسی|Ferdowsi Day and Persian Language Day|Journée de Ferdowsi et de la langue persane|Ferdowsi-Tag und Tag der persischen Sprache", 0, "arts"],
		[2, 28, "⭐", "روز بزرگداشت خیام|Omar Khayyam Day|Journée d'Omar Khayyam|Omar-Chayyam-Tag", 0, "science"],
		[3, 1, "📚", "روز بزرگداشت ملاصدرا|Mulla Sadra Day", 0, "arts"],
		[3, 3, "🕊️", "سالروز آزادسازی خرمشهر|Liberation of Khorramshahr", 0, "state"],
		[3, 14, "🕊️", "رحلت امام خمینی|Death of Ayatollah Khomeini", 1, "state"],
		[3, 15, "🕊️", "قیام ۱۵ خرداد|15 Khordad uprising", 1, "state"],
		[4, 1, "☀️", "آغاز تابستان|First day of summer|Premier jour de l'été|Sommeranfang", 0, "nature"],
		[4, 10, "🏭", "روز صنعت و معدن|Industry and Mining Day", 0, "work"],
		[4, 13, "💧", "جشن تیرگان|Tirgan festival|Fête de Tirgan|Tirgan-Fest", 0, "national"],
		[5, 14, "📜", "سالروز انقلاب مشروطه|Constitutional Revolution Day", 0, "national"],
		[5, 17, "📰", "روز خبرنگار|Journalists' Day (Iran)", 0, "work"],
		[6, 1, "🩺", "روز بزرگداشت ابن‌سینا و روز پزشک|Avicenna Day (Doctors' Day)|Journée d'Avicenne (Journée des médecins)|Avicenna-Tag (Tag der Ärzte)", 0, "science"],
		[6, 4, "💼", "روز کارمند|Employees' Day", 0, "work"],
		[6, 5, "💊", "روز بزرگداشت رازی و روز داروساز|Razi Day (Pharmacists' Day)", 0, "science"],
		[6, 13, "🔭", "روز بزرگداشت ابوریحان بیرونی|Al-Biruni Day", 0, "science"],
		[7, 1, "🍂", "آغاز پاییز و سال تحصیلی|First day of autumn and school|Premier jour de l'automne et rentrée|Herbstanfang und Schulbeginn", 0, "nature"],
		[7, 7, "🚒", "روز آتش‌نشانی و ایمنی|Firefighters' Day", 0, "work"],
		[7, 8, "📜", "روز بزرگداشت مولوی|Rumi Day|Journée de Rûmî|Rumi-Tag", 0, "arts"],
		[7, 10, "🍇", "جشن مهرگان|Mehregan festival|Fête de Mehregan|Mehregan-Fest", 0, "national"],
		[7, 26, "⚽", "روز تربیت بدنی و ورزش|Physical Education and Sports Day (Iran)", 0, "sports"],
		[7, 20, "📜", "روز بزرگداشت حافظ|Hafez Day|Journée de Hafez|Hafis-Tag", 0, "arts"],
		[8, 7, "👑", "روز کوروش بزرگ (غیررسمی)|Cyrus the Great Day (unofficial)|Journée de Cyrus le Grand (non officielle)|Tag Kyros des Großen (inoffiziell)", 0, "national"],
		[8, 13, "🎒", "روز دانش‌آموز|Students' Day (Iran)", 0, "lifestyle"],
		[8, 24, "📚", "روز کتاب و کتابخوانی|Book and Reading Day", 0, "arts"],
		[9, 16, "🎓", "روز دانشجو|University Students' Day (Iran)", 0, "lifestyle"],
		[9, 25, "🔬", "روز پژوهش|Research Day", 0, "science"],
		[9, 30, "🍉", "شب یلدا|Yalda Night|Nuit de Yalda|Yalda-Nacht", 0, "national"],
		[10, 1, "❄️", "آغاز زمستان|First day of winter|Premier jour de l'hiver|Winteranfang", 0, "nature"],
		[11, 10, "🔥", "جشن سده|Sadeh festival|Fête de Sadeh|Sadeh-Fest", 0, "national"],
		[11, 22, "🇮🇷", "پیروزی انقلاب اسلامی|Islamic Revolution Day", 1, "state"],
		[12, 5, "🛠️", "روز بزرگداشت خواجه نصیر و روز مهندس|Nasir al-Din Tusi Day (Engineers' Day)", 0, "work"],
		[12, 15, "🌳", "روز درختکاری|Arbor Day (Iran)|Journée de l'arbre (Iran)|Tag des Baumes (Iran)", 0, "nature"],
		[12, 29, "🛢️", "روز ملی شدن صنعت نفت|Oil Nationalization Day", 1, "state"],
	];
	const LUNAR = [
		[1, 1, "🏴", "آغاز ماه محرم|Start of Muharram", 0, "religious"],
		[1, 9, "🏴", "تاسوعا|Tasua", 1, "religious"],
		[1, 10, "🏴", "عاشورا|Ashura|Achoura|Aschura", 1, "religious"],
		[2, 20, "🏴", "اربعین حسینی|Arbaeen", 1, "religious"],
		[2, 28, "🏴", "رحلت پیامبر و شهادت امام حسن|Death of the Prophet and Imam Hasan", 1, "religious"],
		[2, 30, "🏴", "شهادت امام رضا|Martyrdom of Imam Reza", 1, "religious"],
		[3, 8, "🏴", "شهادت امام حسن عسکری|Martyrdom of Imam Hasan al-Askari", 1, "religious"],
		[3, 17, "🌸", "میلاد پیامبر و امام صادق|Birth of the Prophet (Mawlid)|Naissance du Prophète (Mawlid)|Geburt des Propheten (Maulid)", 1, "religious"],
		[6, 3, "🏴", "شهادت حضرت فاطمه|Martyrdom of Fatimah", 1, "religious"],
		[6, 20, "💐", "روز مادر و روز زن (میلاد حضرت فاطمه)|Mother's Day and Women's Day (Iran)|Fête des mères (Iran)|Muttertag (Iran)", 0, "religious"],
		[7, 13, "👨", "میلاد امام علی و روز پدر|Birth of Imam Ali, Father's Day (Iran)|Naissance de l'imam Ali, fête des pères (Iran)|Geburt Imam Alis, Vatertag (Iran)", 1, "religious"],
		[7, 27, "✨", "عید مبعث|Mab'ath", 1, "religious"],
		[8, 3, "🌸", "میلاد امام حسین|Birth of Imam Hussein", 0, "religious"],
		[8, 15, "💡", "نیمه شعبان (میلاد امام زمان)|Mid-Sha'ban", 1, "religious"],
		[9, 1, "🌙", "آغاز ماه رمضان|Start of Ramadan|Début du ramadan|Beginn des Ramadan", 0, "religious"],
		[9, 19, "🤲", "شب قدر|Night of Qadr", 0, "religious"],
		[9, 21, "🏴", "شهادت امام علی (شب قدر)|Martyrdom of Imam Ali (Night of Qadr)", 1, "religious"],
		[9, 23, "🤲", "شب قدر|Night of Qadr", 0, "religious"],
		[10, 1, "🌙", "عید فطر|Eid al-Fitr|Aïd el-Fitr|Zuckerfest (Eid al-Fitr)", 1, "religious"],
		[10, 2, "🌙", "تعطیل به مناسبت عید فطر|Eid al-Fitr holiday|Aïd el-Fitr|Zuckerfest", 1, "religious"],
		[10, 25, "🏴", "شهادت امام صادق|Martyrdom of Imam Sadiq", 1, "religious"],
		[11, 11, "🌸", "میلاد امام رضا|Birth of Imam Reza", 0, "religious"],
		[12, 9, "🤲", "روز عرفه|Day of Arafah", 0, "religious"],
		[12, 10, "🐑", "عید قربان|Eid al-Adha|Aïd el-Kebir|Opferfest (Eid al-Adha)", 1, "religious"],
		[12, 18, "🌸", "عید غدیر|Eid al-Ghadir", 1, "religious"],
	];
	const WORLD = [
		[1, 1, "🎉", "آغاز سال نو میلادی|New Year's Day|Jour de l'An|Neujahr", 1, "world"],
		[2, 14, "❤️", "روز ولنتاین|Valentine's Day|Saint-Valentin|Valentinstag", 0, "lifestyle"],
		[2, 21, "🗣️", "روز جهانی زبان مادری|International Mother Language Day|Journée internationale de la langue maternelle|Internationaler Tag der Muttersprache", 0, "arts"],
		[3, 8, "👩", "روز جهانی زن|International Women's Day|Journée internationale des femmes|Internationaler Frauentag", 0, "lifestyle"],
		[3, 14, "🥧", "روز عدد پی|Pi Day|Journée de Pi|Pi-Tag", 0, "science"],
		[3, 20, "😊", "روز جهانی شادی|International Day of Happiness|Journée internationale du bonheur|Weltglückstag", 0, "lifestyle"],
		[3, 22, "💧", "روز جهانی آب|World Water Day|Journée mondiale de l'eau|Weltwassertag", 0, "nature"],
		[4, 1, "🃏", "روز دروغ آوریل|April Fools' Day|Poisson d'avril|Aprilscherz", 0, "lifestyle"],
		[4, 7, "🩺", "روز جهانی بهداشت|World Health Day|Journée mondiale de la santé|Weltgesundheitstag", 0, "science"],
		[4, 22, "🌍", "روز زمین|Earth Day|Jour de la Terre|Tag der Erde", 0, "nature"],
		[4, 23, "📚", "روز جهانی کتاب|World Book Day|Journée mondiale du livre|Welttag des Buches", 0, "arts"],
		[5, 1, "🛠️", "روز جهانی کارگر|International Workers' Day|Fête du Travail|Tag der Arbeit", 0, "work"],
		[5, 3, "📰", "روز جهانی آزادی مطبوعات|World Press Freedom Day|Journée mondiale de la liberté de la presse|Internationaler Tag der Pressefreiheit", 0, "work"],
		[5, 15, "👪", "روز جهانی خانواده|International Day of Families|Journée internationale des familles|Internationaler Tag der Familie", 0, "lifestyle"],
		[6, 5, "🌿", "روز جهانی محیط زیست|World Environment Day|Journée mondiale de l'environnement|Weltumwelttag", 0, "nature"],
		[6, 21, "🎵", "روز جهانی موسیقی|World Music Day|Fête de la musique|Fête de la Musique", 0, "arts"],
		[7, 30, "🤝", "روز جهانی دوستی|International Day of Friendship|Journée internationale de l'amitié|Internationaler Tag der Freundschaft", 0, "lifestyle"],
		[8, 12, "🧑", "روز جهانی جوانان|International Youth Day|Journée internationale de la jeunesse|Internationaler Tag der Jugend", 0, "lifestyle"],
		[9, 8, "✏️", "روز جهانی سوادآموزی|International Literacy Day|Journée internationale de l'alphabétisation|Weltalphabetisierungstag", 0, "arts"],
		[9, 21, "🕊️", "روز جهانی صلح|International Day of Peace|Journée internationale de la paix|Weltfriedenstag", 0, "world"],
		[9, 27, "✈️", "روز جهانی گردشگری|World Tourism Day|Journée mondiale du tourisme|Welttourismustag", 0, "lifestyle"],
		[10, 1, "👵", "روز جهانی سالمندان|International Day of Older Persons|Journée internationale des personnes âgées|Internationaler Tag der älteren Menschen", 0, "lifestyle"],
		[10, 4, "🐾", "روز جهانی حیوانات|World Animal Day|Journée mondiale des animaux|Welttierschutztag", 0, "nature"],
		[10, 5, "👩‍🏫", "روز جهانی معلم|World Teachers' Day|Journée mondiale des enseignants|Weltlehrertag", 0, "work"],
		[10, 16, "🍞", "روز جهانی غذا|World Food Day|Journée mondiale de l'alimentation|Welternährungstag", 0, "lifestyle"],
		[10, 31, "🎃", "هالووین|Halloween|Halloween|Halloween", 0, "lifestyle"],
		[11, 17, "🎓", "روز جهانی دانشجو|International Students' Day|Journée internationale des étudiants|Internationaler Studententag", 0, "lifestyle"],
		[11, 20, "🧒", "روز جهانی کودک|World Children's Day|Journée mondiale de l'enfance|Weltkindertag (UN)", 0, "lifestyle"],
		[12, 3, "♿", "روز جهانی افراد دارای معلولیت|International Day of Persons with Disabilities|Journée internationale des personnes handicapées|Internationaler Tag der Menschen mit Behinderungen", 0, "world"],
		[12, 10, "⚖️", "روز جهانی حقوق بشر|Human Rights Day|Journée des droits de l'homme|Tag der Menschenrechte", 0, "world"],
		[12, 24, "🎄", "شب کریسمس|Christmas Eve|Réveillon de Noël|Heiligabend", 0, "religious"],
		[12, 25, "🎄", "کریسمس|Christmas|Noël|Weihnachten", 1, "religious"],
		[4, 6, "⚽", "روز جهانی ورزش برای توسعه و صلح|International Day of Sport for Development and Peace|Journée internationale du sport au service du développement et de la paix|Internationaler Tag des Sports für Entwicklung und Frieden", 0, "sports"],
		[6, 23, "🏅", "روز المپیک|Olympic Day|Journée olympique|Olympischer Tag", 0, "sports"],
		[5, 17, "📡", "روز جهانی ارتباطات و جامعه‌ی اطلاعاتی|World Telecommunication and Information Society Day|Journée mondiale des télécommunications et de la société de l'information|Weltfernmeldetag", 0, "tech"],
		[10, 4, "🚀", "آغاز هفته‌ی جهانی فضا|World Space Week begins|Début de la Semaine mondiale de l'espace|Beginn der Weltraumwoche", 0, "science"],
		[11, 30, "💻", "روز جهانی امنیت رایانه|Computer Security Day|Journée de la sécurité informatique|Tag der Computersicherheit", 0, "tech"],
		[12, 31, "🎆", "شب سال نو میلادی|New Year's Eve|Saint-Sylvestre|Silvester", 0, "lifestyle"],
	];

	const DAY = 86400000;
	const noon = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
	const addDays = (d, n) => noon(new Date(d.getTime() + n * DAY));
	const fmt = {};
	function parts(cal, d) {
		const f = (fmt[cal] ||= new Intl.DateTimeFormat(`en-US-u-ca-${cal}-nu-latn`, { year: "numeric", month: "numeric", day: "numeric" }));
		const o = {};
		for (const p of f.formatToParts(d)) if (p.type !== "literal" && p.type !== "era") o[p.type === "relatedYear" ? "year" : p.type] = parseInt(p.value, 10);
		return o;
	}
	// Western Easter Sunday (anonymous Gregorian algorithm).
	function easter(y) {
		const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
		const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
		const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
		return [month, day];
	}
	const cache = new Map();
	/** [{emoji, name, off, kind: "iran" | "world"}] for a day. Holidays (off) count only when that set is on. */
	function forDay(date, opts) {
		const d = noon(date);
		const iran = opts ? opts.iran : true, world = opts ? opts.world : true;
		const off = (opts && opts.cats) || {};
		// Shown when its category is on, or when it is an official holiday and holidays are on.
		const shown = (cat, hol) => off[cat] !== false || (hol && off.holiday !== false && iran);
		const ck = d.toDateString() + I18n.lang + iran + world + JSON.stringify(off);
		if (cache.has(ck)) return cache.get(ck);
		const out = [];
		const add = (row, kind, offOK) => {
			if (!shown(row[5], !!row[4] && offOK)) return;
			out.push({ emoji: row[2], name: name(row[3]), off: !!row[4] && offOK && off.holiday !== false, kind, cat: row[5] });
		};
		const push = (emoji, names, kind, cat) => shown(cat, false) && out.push({ emoji, name: name(names), off: false, kind, cat });
		if (iran) {
			const j = parts("persian", d), h = parts("islamic-umalqura", d);
			for (const r of SOLAR) if (j.month === r[0] && j.day === r[1]) add(r, "iran", true);
			// Chaharshanbe Suri: the evening before the last Wednesday of the year.
			if (d.getDay() === 2 && j.month === 12 && parts("persian", addDays(d, 1)).month === 12 && parts("persian", addDays(d, 8)).month === 1)
				push("🔥", "چهارشنبه‌سوری|Chaharshanbe Suri (fire festival)|Tchaharchanbé-Souri (fête du feu)|Tschaharschanbe Suri (Feuerfest)", "iran", "national");
			for (const r of LUNAR) {
				if (h.month === r[0] && h.day === r[1]) add(r, "iran", true);
				// "30 Safar" is the last day of Safar, which may be the 29th.
				else if (r[0] === 2 && r[1] === 30 && h.month === 2 && h.day === 29 && parts("islamic-umalqura", addDays(d, 1)).month === 3) add(r, "iran", true);
			}
		}
		if (world) {
			const m = d.getMonth() + 1, day = d.getDate();
			for (const r of WORLD) if (m === r[0] && day === r[1]) add(r, "world", !iran);
			const [em, ed] = easter(d.getFullYear());
			if (m === em && day === ed) push("🐣", "عید پاک|Easter|Pâques|Ostern", "world", "religious");
			if (m === 5 && d.getDay() === 0 && day >= 8 && day <= 14) push("💐", "روز مادر (در بسیاری از کشورها)|Mother's Day (many countries)|Fête des mères (nombreux pays)|Muttertag (viele Länder)", "world", "lifestyle");
			if (m === 6 && d.getDay() === 0 && day >= 15 && day <= 21) push("👔", "روز پدر (در بسیاری از کشورها)|Father's Day (many countries)|Fête des pères (nombreux pays)|Vatertag (viele Länder)", "world", "lifestyle");
		}
		if (cache.size > 800) cache.clear();
		cache.set(ck, out);
		return out;
	}
	// Categories that can be switched on and off in Settings: [id, emoji].
	const CATS = [["holiday", "🌴"], ["state", "🏛️"], ["religious", "🕌"], ["national", "🦁"], ["arts", "🎨"], ["science", "🔭"], ["nature", "🌿"], ["work", "💼"], ["lifestyle", "🪴"], ["sports", "⚽"], ["tech", "💻"], ["world", "🌍"]];
	window.Occasions = { forDay, CATS };
})();
