/* Rubi screenshot page: gets the capture from the background, stitches it into one picture,
 * and saves it as PNG, JPG or PDF (or copies / prints it). Nothing leaves the computer. */
(async () => {
	"use strict";
	const $ = (id) => document.getElementById(id);
	const L = {
		fa: { title: "عکس از صفحه", actions: "ذخیره", name: "نام فایل", format: "قالب", quality: "کیفیت", save: "ذخیره", savePdf: "ذخیره به PDF", copy: "کپی در کلیپ‌بورد", print: "چاپ", auto: "دفعه‌های بعد با همین تنظیمات خودکار ذخیره شود", loading: "در حال آماده کردن…", saved: "ذخیره شد ✓ (پوشه‌ی دانلودها)", copied: "کپی شد ✓", gone: "این عکس دیگر در دسترس نیست. دوباره از منوی راست‌کلیک عکس بگیرید.", copyFail: "کپی ممکن نشد", size: "{w}×{h} پیکسل" },
		en: { title: "Screenshot", actions: "Save", name: "File name", format: "Format", quality: "Quality", save: "Save", savePdf: "Save as PDF", copy: "Copy to clipboard", print: "Print", auto: "Next time, save automatically with these settings", loading: "Preparing…", saved: "Saved ✓ (Downloads folder)", copied: "Copied ✓", gone: "This capture is no longer available. Take it again from the right-click menu.", copyFail: "Couldn't copy", size: "{w}×{h} px" },
		fr: { title: "Capture d'écran", actions: "Enregistrer", name: "Nom du fichier", format: "Format", quality: "Qualité", save: "Enregistrer", savePdf: "Enregistrer en PDF", copy: "Copier", print: "Imprimer", auto: "La prochaine fois, enregistrer automatiquement ainsi", loading: "Préparation…", saved: "Enregistré ✓ (Téléchargements)", copied: "Copié ✓", gone: "Cette capture n'est plus disponible. Recommencez depuis le clic droit.", copyFail: "Copie impossible", size: "{w}×{h} px" },
		de: { title: "Screenshot", actions: "Speichern", name: "Dateiname", format: "Format", quality: "Qualität", save: "Speichern", savePdf: "Als PDF speichern", copy: "In die Zwischenablage", print: "Drucken", auto: "Nächstes Mal automatisch so speichern", loading: "Wird vorbereitet…", saved: "Gespeichert ✓ (Downloads)", copied: "Kopiert ✓", gone: "Diese Aufnahme ist nicht mehr verfügbar. Bitte erneut per Rechtsklick aufnehmen.", copyFail: "Kopieren nicht möglich", size: "{w}×{h} px" }
	};
	const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } };
	const st = await chrome.storage.local.get("hamyar_data").catch(() => ({}));
	const lang = (st.hamyar_data && st.hamyar_data.settings && st.hamyar_data.settings.lang) || ((navigator.language || "en").startsWith("fa") ? "fa" : "en");
	const T = L[lang] || L.en;
	const tr = (k, p = {}) => (T[k] || k).replace(/\{(\w+)\}/g, (_, x) => p[x]);
	document.documentElement.lang = lang;
	document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
	$("aTitle").textContent = T.actions;
	$("lName").textContent = T.name;
	$("lFormat").textContent = T.format;
	$("lQuality").textContent = T.quality;
	$("copy").textContent = "📋 " + T.copy;
	$("print").textContent = "🖨️ " + T.print;
	$("lAuto").textContent = T.auto;
	$("loading").textContent = T.loading;
	const msg = (text, err) => { $("msg").textContent = text; $("msg").classList.toggle("err", !!err); };

	const id = location.hash.slice(1);
	const shot = id ? await chrome.runtime.sendMessage({ kamyar: "shot", id }).catch(() => null) : null;
	if (!shot) { $("loading").textContent = T.gone; document.querySelectorAll("button").forEach((b) => (b.disabled = true)); return; }
	$("hTitle").textContent = shot.title || T.title;
	document.title = "📸 " + (shot.title || T.title);
	$("hUrl").textContent = shot.url;
	if (/^https?:/.test(shot.url)) $("hUrl").href = shot.url;

	/* ---------- one picture from the strips ---------- */
	const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
	const imgs = await Promise.all(shot.parts.map((p) => load(p.data)));
	const scale = imgs[0].naturalWidth / shot.w; // real pixels per CSS pixel
	let canvas = document.createElement("canvas");
	if (shot.crop) {
		const c = shot.crop;
		canvas.width = Math.round(c.w * scale);
		canvas.height = Math.round(c.h * scale);
		canvas.getContext("2d").drawImage(imgs[0], c.x * scale, c.y * scale, c.w * scale, c.h * scale, 0, 0, canvas.width, canvas.height);
	} else {
		const MAX = 32000; // browsers can't draw taller canvases
		const fullH = Math.round(shot.h * scale);
		const k = fullH > MAX ? MAX / fullH : 1;
		canvas.width = Math.round(imgs[0].naturalWidth * k);
		canvas.height = Math.round(fullH * k);
		const g = canvas.getContext("2d");
		shot.parts.forEach((p, i) => g.drawImage(imgs[i], 0, Math.round(p.y * scale * k), canvas.width, Math.round(imgs[i].naturalHeight * k)));
	}
	$("preview").replaceChildren(canvas);
	$("size").textContent = tr("size", { w: canvas.width, h: canvas.height });

	/* ---------- settings ---------- */
	const d = new Date(shot.at || Date.now());
	const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
	const clean = (s) => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
	$("fname").value = clean((shot.title || "Screenshot") + " - " + stamp);
	let fmt = ls("kamyar_shot_fmt") || "png";
	$("quality").value = ls("kamyar_shot_q") || "90";
	$("autoSave").checked = ls("kamyar_shot_auto") === "1";
	function drawFmt() {
		document.querySelectorAll("#fmt button").forEach((b) => b.classList.toggle("on", b.dataset.f === fmt));
		$("qRow").hidden = fmt === "png";
		$("qOut").textContent = $("quality").value + "%";
		$("save").textContent = "⬇️ " + (fmt === "pdf" ? T.savePdf : T.save + " " + fmt.toUpperCase());
	}
	document.querySelectorAll("#fmt button").forEach((b) => b.addEventListener("click", () => { fmt = b.dataset.f; ls("kamyar_shot_fmt", fmt); drawFmt(); }));
	$("quality").addEventListener("input", () => { ls("kamyar_shot_q", $("quality").value); drawFmt(); });
	$("autoSave").addEventListener("change", (e) => ls("kamyar_shot_auto", e.target.checked ? "1" : "0"));
	drawFmt();

	/* ---------- saving ---------- */
	const blobOf = (type, q) => new Promise((ok) => canvas.toBlob(ok, type, q));
	function download(blob, ext) {
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		a.download = (clean($("fname").value) || "Screenshot") + "." + ext;
		document.body.append(a);
		a.click();
		a.remove();
		setTimeout(() => URL.revokeObjectURL(a.href), 30000);
	}
	// A small PDF writer: the picture is cut into pages of A4 shape, each page one JPEG.
	async function pdfBlob(q) {
		const W = canvas.width, pageH = Math.min(canvas.height, Math.round(W * 1.414));
		const pages = [];
		for (let y = 0; y < canvas.height; y += pageH) {
			const h = Math.min(pageH, canvas.height - y);
			const c = document.createElement("canvas");
			c.width = W;
			c.height = h;
			const g = c.getContext("2d");
			g.fillStyle = "#fff";
			g.fillRect(0, 0, W, h);
			g.drawImage(canvas, 0, y, W, h, 0, 0, W, h);
			const b = await new Promise((ok) => c.toBlob(ok, "image/jpeg", q));
			pages.push({ w: W, h, jpg: new Uint8Array(await b.arrayBuffer()) });
		}
		const enc = new TextEncoder();
		const chunks = [];
		let len = 0;
		const offs = [];
		const put = (x) => { const u = typeof x === "string" ? enc.encode(x) : x; chunks.push(u); len += u.length; };
		const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
		put("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
		const n = pages.length;
		// 1 catalog, 2 page tree, then for each page: page, image, contents
		const pageIds = pages.map((_, i) => 3 + i * 3);
		obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
		obj(2, () => put(`<< /Type /Pages /Count ${n} /Kids [${pageIds.map((x) => x + " 0 R").join(" ")}] >>`));
		const pt = 0.75 / scale; // CSS px → points, independent of screen density
		pages.forEach((p, i) => {
			const pid = pageIds[i], iid = pid + 1, cid = pid + 2;
			const w = (p.w * pt).toFixed(2), h = (p.h * pt).toFixed(2);
			obj(pid, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
			obj(iid, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); put(p.jpg); put("\nendstream"); });
			const cs = `q ${w} 0 0 ${h} 0 0 cm /Im${i} Do Q`;
			obj(cid, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
		});
		const xref = len;
		const total = 3 + n * 3;
		put(`xref\n0 ${total}\n0000000000 65535 f \n`);
		for (let i = 1; i < total; i++) put(String(offs[i]).padStart(10, "0") + " 00000 n \n");
		put(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
		return new Blob(chunks, { type: "application/pdf" });
	}
	async function save() {
		$("save").disabled = true;
		try {
			const q = Number($("quality").value) / 100;
			if (fmt === "png") download(await blobOf("image/png"), "png");
			else if (fmt === "jpg") download(await blobOf("image/jpeg", q), "jpg");
			else download(await pdfBlob(q), "pdf");
			msg(T.saved);
		} catch (e) {
			msg(String(e.message || e), true);
		}
		$("save").disabled = false;
	}
	$("save").addEventListener("click", save);
	$("copy").addEventListener("click", async () => {
		try {
			await navigator.clipboard.write([new ClipboardItem({ "image/png": blobOf("image/png") })]);
			msg(T.copied);
		} catch {
			msg(T.copyFail, true);
		}
	});
	$("print").addEventListener("click", () => {
		const box = document.createElement("div");
		box.id = "printImg";
		const img = new Image();
		img.src = canvas.toDataURL("image/png");
		box.append(img);
		document.body.append(box);
		img.onload = () => { print(); box.remove(); };
	});
	if ($("autoSave").checked) save();
})();
