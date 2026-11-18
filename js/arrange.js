/* Arranging boxes: drag a box by its ⠿ handle (or use the arrow keys on it) to move it.
 * Tools page: order (toolsOrder), full-width boxes (toolsWide) and the number of columns (toolsCols).
 * Services page: order of the categories (svcOrder) and the number of columns (svcCols).
 * Everything is saved in settings, so it travels with the data to other computers. */
(function () {
	"use strict";
	const { $, el, setting } = H;

	/** Make the children of `box` matching `item` sortable by dragging their `.drag-h` handle.
	 * `done(ids)` gets the new order of data-key values. */
	function sortable(box, item, done) {
		let dragging = null;
		const items = () => [...box.children].filter((n) => n.matches(item));
		box.addEventListener("pointerdown", (e) => {
			const h = e.target.closest(".drag-h");
			if (!h || !box.contains(h)) return;
			const it = h.closest(item);
			if (it && it.parentElement === box) it.draggable = true;
		});
		document.addEventListener("pointerup", () => items().forEach((n) => n !== dragging && (n.draggable = false)));
		box.addEventListener("dragstart", (e) => {
			const it = e.target.closest && e.target.closest(item);
			if (!it || it.parentElement !== box || !it.draggable) return;
			dragging = it;
			it.classList.add("dragging");
			box.classList.add("sorting");
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", it.dataset.key || "");
		});
		box.addEventListener("dragover", (e) => {
			if (!dragging) return;
			e.preventDefault();
			const over = e.target.closest && e.target.closest(item);
			if (!over || over === dragging || over.parentElement !== box) return;
			const r = over.getBoundingClientRect();
			// Chips in a row compare across, boxes compare up and down.
			const flat = r.height < 60 && r.width < 300;
			const rtl = getComputedStyle(box).direction === "rtl";
			const after = flat ? (rtl ? e.clientX < r.left + r.width / 2 : e.clientX > r.left + r.width / 2) : e.clientY > r.top + r.height / 2;
			const ref = after ? over.nextSibling : over;
			if (ref !== dragging && dragging.nextSibling !== ref) box.insertBefore(dragging, ref);
		});
		box.addEventListener("drop", (e) => dragging && e.preventDefault());
		box.addEventListener("dragend", () => {
			if (!dragging) return;
			dragging.draggable = false;
			dragging.classList.remove("dragging");
			box.classList.remove("sorting");
			dragging = null;
			done(items().map((n) => n.dataset.key));
		});
		// Keyboard: arrow keys on a handle move its item one place.
		box.addEventListener("keydown", (e) => {
			const h = e.target.closest && e.target.closest(".drag-h");
			if (!h) return;
			const rtl = getComputedStyle(box).direction === "rtl";
			const back = e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft");
			const fwd = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight");
			if (!back && !fwd) return;
			e.preventDefault();
			const it = h.closest(item);
			const list = items().filter((n) => !n.hidden);
			const j = list.indexOf(it) + (back ? -1 : 1);
			if (j < 0 || j >= list.length) return;
			box.insertBefore(it, back ? list[j] : list[j].nextSibling);
			done(items().map((n) => n.dataset.key));
			const again = [...box.querySelectorAll(".drag-h")].find((x) => x.closest(item)?.dataset.key === it.dataset.key);
			again?.focus();
		});
	}
	/** Sort a list by a saved order of keys; unknown keys keep their place after the known ones. */
	const byOrder = (list, order, key) => {
		if (!Array.isArray(order) || !order.length) return list;
		const rank = (x, i) => { const r = order.indexOf(key(x)); return r < 0 ? order.length + i : r; };
		return list.map((x, i) => [x, rank(x, i)]).sort((a, b) => a[1] - b[1]).map((p) => p[0]);
	};
	const handle = (label) => el("button", { class: "drag-h", type: "button", title: label, "aria-label": label }, "⠿");
	H.sortable = sortable;
	H.byOrder = byOrder;
	H.dragHandle = () => handle(t("boxMove"));

	/* ---------- Tools page ---------- */
	const grid = document.querySelector("#viewTools .widgets");
	const boxes = () => [...grid.querySelectorAll(":scope > [data-widget]")];
	const wide = () => setting("toolsWide", {}) || {};
	const DEFAULT = boxes().map((b) => b.dataset.widget);
	const custom = () => (setting("toolsOrder", []) || []).length || Object.values(wide()).some(Boolean) || setting("toolsCols", 0);

	boxes().forEach((box) => {
		const w = (box.dataset.key = box.dataset.widget);
		box.append(handle(t("boxMove")),
			el("button", { class: "box-size", type: "button", onclick: () => Store.setSetting("toolsWide", { ...wide(), [w]: !wide()[w] }) }, "⤢"));
	});
	sortable(grid, "[data-widget]", (ids) => {
		// A box can be away from the page (the timer in focus mode): it keeps its place in the saved order.
		const saved = setting("toolsOrder", []) || [];
		const full = byOrder(DEFAULT, saved, (w) => w);
		const set = new Set(ids);
		let i = 0;
		const next = full.map((w) => (set.has(w) ? ids[i++] : w));
		if (String(next) !== String(saved)) Store.setSetting("toolsOrder", next);
	});

	// Tools bar: number of columns and going back to the original layout.
	const colsBox = el("div", { class: "seg tools-cols", role: "group" });
	const reset = el("button", { class: "chip", type: "button", onclick: () => {
		const keep = { o: setting("toolsOrder", []), w: wide(), c: setting("toolsCols", 0) };
		Store.setSetting("toolsOrder", []);
		Store.setSetting("toolsWide", {});
		Store.setSetting("toolsCols", 0);
		H.toast(t("layoutReset"), { run: () => { Store.setSetting("toolsOrder", keep.o); Store.setSetting("toolsWide", keep.w); Store.setSetting("toolsCols", keep.c); } });
	} });
	document.querySelector("#viewTools .tools-bar").append(el("span", { class: "tools-hint muted small" }), colsBox, reset);

	function apply() {
		const order = setting("toolsOrder", []);
		const want = byOrder(order && order.length ? boxes() : DEFAULT.map((w) => grid.querySelector(`:scope > [data-widget="${w}"]`)).filter(Boolean), order, (b) => b.dataset.widget);
		if (!grid.classList.contains("sorting") && want.some((b, i) => b !== boxes()[i])) want.forEach((b) => grid.append(b));
		const wd = wide();
		boxes().forEach((b) => {
			b.classList.toggle("wide", !!wd[b.dataset.widget]);
			const s = b.querySelector(":scope > .box-size");
			s.title = t(wd[b.dataset.widget] ? "boxNarrow" : "boxWide");
			s.setAttribute("aria-label", s.title);
			const m = b.querySelector(":scope > .drag-h");
			m.title = t("boxMove");
			m.setAttribute("aria-label", m.title);
		});
		const cols = setting("toolsCols", 0) || 0;
		grid.style.columns = cols ? String(cols) : "";
		grid.style.maxWidth = cols === 4 ? "1500px" : cols === 2 ? "900px" : "";
		colsBox.replaceChildren(el("span", { class: "seg-label" }, t("layoutCols")), ...[2, 3, 4].map((n) =>
			el("button", { type: "button", class: "seg-btn" + ((cols || 3) === n ? " active" : ""), "aria-pressed": String((cols || 3) === n), onclick: () => Store.setSetting("toolsCols", n === 3 ? 0 : n) }, H.num(n))));
		reset.textContent = "↺ " + t("layoutReset0");
		reset.hidden = !custom();
		document.querySelector("#viewTools .tools-hint").textContent = t("layoutHint");
	}
	apply();
	H.onRefresh(apply);
})();
