/* Downloads a logo for each site listed on the Services page (js/services.js, js/services-ir.js)
 * into icons/sites/<host>.<ext>, and writes js/site-icons.js with the list of hosts found.
 * Sites that already have a bundled brand logo (icons/brands) are skipped.
 * Run by the "Fetch site logos" workflow; needs Node 20+ (built-in fetch). */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "icons/sites");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

const brandMap = JSON.parse(read("js/brands.js").match(/const MAP = (\{.*?\});/s)[1]);
const hasBrand = (host) => {
	let h = host;
	while (h.includes(".")) {
		if (brandMap[h]) return true;
		h = h.slice(h.indexOf(".") + 1);
	}
	return false;
};

const urls = [...new Set([...(read("js/services.js") + read("js/services-ir.js")).matchAll(/"(https:\/\/[^"]+)"/g)].map((m) => m[1]))];
const hosts = [...new Set(urls.map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; } }).filter(Boolean))]
	.filter((h) => !hasBrand(h) && !h.includes("google.com/s2"));

const EXT = { "image/png": "png", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "image/svg+xml": "svg", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function get(url) {
	try {
		const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15000) });
		if (!r.ok) return null;
		const type = (r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
		const ext = EXT[type];
		if (!ext) return null;
		const buf = Buffer.from(await r.arrayBuffer());
		if (buf.length < 100) return null;
		return { buf, ext };
	} catch {
		return null;
	}
}
// PNG width, to prefer a sharp icon over a 16-pixel one.
const pngWidth = (b) => (b.length > 24 && b.readUInt32BE(0) === 0x89504e47 ? b.readUInt32BE(16) : 0);

async function logo(host) {
	const tries = [
		`https://www.google.com/s2/favicons?sz=128&domain_url=https://${host}`,
		`https://icons.duckduckgo.com/ip3/${host}.ico`,
		`https://${host}/apple-touch-icon.png`,
		`https://www.${host}/apple-touch-icon.png`,
		`https://${host}/favicon.ico`
	];
	let small = null;
	for (const u of tries) {
		const r = await get(u);
		if (!r) continue;
		if (r.ext === "png" && pngWidth(r.buf) && pngWidth(r.buf) < 32) { small = small || r; continue; }
		return r;
	}
	return small;
}

(async () => {
	fs.mkdirSync(OUT, { recursive: true });
	const found = {};
	let i = 0;
	const queue = [...hosts];
	async function worker() {
		while (queue.length) {
			const h = queue.shift();
			const r = await logo(h);
			i++;
			if (r) {
				fs.writeFileSync(path.join(OUT, `${h}.${r.ext}`), r.buf);
				found[h] = r.ext;
				console.log(`${i}/${hosts.length} ✓ ${h}`);
			} else console.log(`${i}/${hosts.length} ✗ ${h}`);
		}
	}
	await Promise.all(Array.from({ length: 8 }, worker));
	const sorted = Object.fromEntries(Object.entries(found).sort());
	fs.writeFileSync(path.join(ROOT, "js/site-icons.js"),
		"/* Bundled site logos in icons/sites, made by .github/scripts/fetch-logos.js: host → file type. */\nwindow.SITE_ICONS = " + JSON.stringify(sorted) + ";\n");
	console.log(`\n${Object.keys(found).length} of ${hosts.length} logos saved.`);
})();
