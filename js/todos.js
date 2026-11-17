/* Tasks: boards (columns), labels, priority, date & time, repeat, reminders,
 * sort / group / filter, a compact list on the home page and a full Tasks page with list and board views. */
(function () {
	"use strict";
	const { $, el, num } = H;
	const COLORS = { teal: "#14b8a6", blue: "#3b82f6", indigo: "#6366f1", purple: "#a855f7", pink: "#ec4899", red: "#ef4444", orange: "#f97316", amber: "#f59e0b", green: "#22c55e", slate: "#64748b" };
	const PR_COLOR = ["", "#3b82f6", "#f59e0b", "#ef4444"];
	const VIEW_KEY = "hamyar_todo_view";
	const DAY = 86400000;

	/* ---------- view state (per device) ---------- */
	let view = { sort: "smart", group: "due", board: "", label: "", priority: "", showDone: false, page: "list", homeGroup: "due" };
	try {
		view = { ...view, ...JSON.parse(localStorage.getItem(VIEW_KEY) || "{}") };
	} catch {}
	const saveView = () => {
		try {
			localStorage.setItem(VIEW_KEY, JSON.stringify(view));
		} catch {}
		render();
	};

	/* ---------- data helpers ---------- */
	const boards = () => Store.list("board");
	const labels = () => Store.list("label");
	const todos = () => Store.list("todo");
	const boardById = (id) => id && Store.get().items[id] && !Store.get().items[id].deleted ? Store.get().items[id] : null;
	const labelById = (id) => (id && Store.get().items[id] && !Store.get().items[id].deleted ? Store.get().items[id] : null);
	const colorOf = (c) => COLORS[c] || c || COLORS.slate;

	const todayStr = () => {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	};
	const toStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	const parse = (s) => new Date(s + "T12:00");
	const dayDiff = (s) => Math.round((parse(s) - parse(todayStr())) / DAY);

	function dueGroup(x) {
		if (!x.due) return "nodate";
		const d = dayDiff(x.due);
		if (d < 0) return "past";
		if (d === 0) return "today";
		if (d === 1) return "tomorrow";
		if (d < 7) return "week";
		return "later";
	}
	function dueText(x) {
		if (!x.due) return "";
		const d = dayDiff(x.due);
		const rtf = new Intl.RelativeTimeFormat(I18n.locale, { numeric: "auto" });
		let s = Math.abs(d) <= 2 ? rtf.format(d, "day") : Math.abs(d) < 7 ? new Intl.DateTimeFormat(I18n.locale, { weekday: "long" }).format(parse(x.due)) : H.fmtDate(parse(x.due), H.calOrder()[0], false);
		if (x.time) s += " " + new Intl.DateTimeFormat(I18n.locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(Date.UTC(2000, 0, 1, +x.time.slice(0, 2), +x.time.slice(3, 5)));
		return s;
	}

	function nextDue(due, repeat) {
		const d = parse(due || todayStr());
		if (repeat === "daily") d.setDate(d.getDate() + 1);
		else if (repeat === "weekdays") {
			do d.setDate(d.getDate() + 1);
			while (H.setting("iranHolidays", true) ? d.getDay() === 5 : d.getDay() === 0 || d.getDay() === 6);
		} else if (repeat === "weekly") d.setDate(d.getDate() + 7);
		else if (repeat === "monthly") {
			const day = d.getDate();
			d.setDate(1);
			d.setMonth(d.getMonth() + 1);
			d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
		} else if (repeat === "yearly") d.setFullYear(d.getFullYear() + 1);
		return toStr(d);
	}

	function setDone(x, done) {
		if (done && x.repeat && !x.done) {
			// Repeating task: keep a completed copy and move this one to the next date.
			const copy = { ...x };
			delete copy.id;
			Store.add("todo", { ...copy, done: true, repeat: "", remind: false, doneAt: Date.now() });
			Store.update(x.id, { due: nextDue(x.due, x.repeat) });
			H.toast(t("nextRepeat", { date: dueText({ due: nextDue(x.due, x.repeat) }) }));
			return;
		}
		Store.update(x.id, { done, doneAt: done ? Date.now() : null });
	}

	function removeTodo(x) {
		Store.remove(x.id);
		const snap = { ...x };
		delete snap.id;
		H.toast(t("todoDeleted"), { run: () => Store.add("todo", snap) });
	}

	/* ---------- filtering, sorting, grouping ---------- */
	function visible(scope) {
		return todos().filter((x) => {
			if (!view.showDone && x.done) return false;
			{
				if (view.board === "_none" && x.board) return false;
				if (view.board && view.board !== "_none" && x.board !== view.board) return false;
				if (view.label && !(x.labels || []).includes(view.label)) return false;
				if (view.priority !== "" && String(x.priority || 0) !== view.priority) return false;
			}
			return true;
		});
	}
	function sorted(list) {
		const by = view.sort;
		const dueKey = (x) => (x.due || "9999-99-99") + (x.time || "99:99");
		return [...list].sort((a, b) => {
			if (a.done !== b.done) return a.done ? 1 : -1;
			if (by === "created") return b.createdAt - a.createdAt;
			if (by === "priority") return (b.priority || 0) - (a.priority || 0) || dueKey(a).localeCompare(dueKey(b));
			if (by === "due") return dueKey(a).localeCompare(dueKey(b));
			// smart: date, then priority, then manual order
			return dueKey(a).localeCompare(dueKey(b)) || (b.priority || 0) - (a.priority || 0) || (a.order ?? 0) - (b.order ?? 0);
		});
	}
	const DUE_ORDER = ["past", "today", "tomorrow", "week", "later", "nodate"];
	const DUE_LABEL = { past: "grpPast", today: "grpToday", tomorrow: "grpTomorrow", week: "grpWeek", later: "grpLater", nodate: "grpNoDate" };
	function grouped(list, mode) {
		const open = list.filter((x) => !x.done), done = list.filter((x) => x.done);
		const groups = [];
		const push = (key, title, items, color) => items.length && groups.push({ key, title, items, color });
		if (mode === "due") for (const k of DUE_ORDER) push(k, t(DUE_LABEL[k]), open.filter((x) => dueGroup(x) === k), k === "past" ? "var(--danger)" : null);
		else if (mode === "priority") for (const p of [3, 2, 1, 0]) push("p" + p, t(["prNone", "prLow", "prMedium", "prHigh"][p]), open.filter((x) => (x.priority || 0) === p), PR_COLOR[p] || null);
		else if (mode === "label") {
			for (const l of labels()) push(l.id, l.name, open.filter((x) => (x.labels || []).includes(l.id)), colorOf(l.color));
			push("_nolabel", t("noLabel"), open.filter((x) => !(x.labels || []).some(labelById)), null);
		} else if (mode === "board") {
			push("_default", t("defaultBoard"), open.filter((x) => !boardById(x.board)), null);
			for (const b of boards()) push(b.id, b.name, open.filter((x) => x.board === b.id), colorOf(b.color));
		} else push("all", "", open, null);
		push("_done", t("completedSection"), done, null);
		return groups;
	}

	/* ---------- rendering ---------- */
	function chip(text, cls, color) {
		const c = el("span", { class: "chip-s " + (cls || "") }, text);
		if (color) c.style.setProperty("--c", color);
		return c;
	}
	function row(x, opts = {}) {
		const meta = [];
		const b = boardById(x.board);
		if (b && opts.showBoard !== false) meta.push(chip(b.name, "board", colorOf(b.color)));
		for (const id of x.labels || []) {
			const l = labelById(id);
			if (l) meta.push(chip(l.name, "label", colorOf(l.color)));
		}
		if (x.due) {
			const g = dueGroup(x);
			meta.push(chip(dueText(x), "due" + (!x.done && g === "past" ? " overdue" : !x.done && g === "today" ? " soon" : "")));
		}
		if (x.repeat) meta.push(chip("🔁", "icon", null));
		if (x.remind && x.time) meta.push(chip("🔔", "icon", null));
		const li = el(
			"li",
			{ class: "todo" + (x.done ? " done" : ""), "data-id": x.id, draggable: opts.draggable ? "true" : null, ondragstart: (e) => { e.dataTransfer.setData("text/plain", x.id); li.classList.add("dragging"); }, ondragend: () => li.classList.remove("dragging") },
			el("input", { type: "checkbox", checked: x.done, "aria-label": x.text, onchange: (e) => setDone(x, e.target.checked), style: x.priority ? `--pr:${PR_COLOR[x.priority]}` : null, class: x.priority ? "pr" : null }),
			el(
				"button",
				{ class: "todo-main", type: "button", onclick: () => openEditor(x) },
				el("span", { class: "todo-text", dir: "auto" }, x.text),
				x.desc ? el("span", { class: "todo-desc", dir: "auto" }, x.desc.slice(0, 140)) : null,
				meta.length ? el("span", { class: "todo-meta" }, ...meta) : null
			),
			el("button", { class: "icon-btn small del", type: "button", "aria-label": t("delete"), title: t("delete"), onclick: () => removeTodo(x) }, "×")
		);
		return li;
	}
	function groupsEl(list, mode, opts) {
		const gs = grouped(sorted(list), mode);
		if (!gs.length) return el("div", { class: "empty side-empty" }, el("div", { class: "empty-art" }, "☑"), el("p", {}, t("todosEmpty")), el("div", { class: "chips" }, ...["sugg1", "sugg2", "sugg3"].map((k) => el("button", { class: "chip-sugg", type: "button", onclick: () => { $("todoInput").value = t(k); $("todoInput").focus(); } }, t(k)))));
		const frag = el("div", { class: "todo-groups-inner" });
		for (const g of gs) {
			const head = mode === "none" && g.key === "all" ? null : el("div", { class: "grp-head" }, g.color ? el("i", { class: "dot", style: `background:${g.color}` }) : null, el("span", {}, g.title), el("span", { class: "muted small" }, num(g.items.length)));
			frag.append(...[head, el("ul", { class: "todo-list" }, ...g.items.map((x) => row(x, opts)))].filter(Boolean));
		}
		return frag;
	}

	function select(id, value, options, onchange) {
		return el("select", { id, onchange: (e) => onchange(e.target.value) }, ...options.map(([v, label]) => el("option", { value: v, selected: v === value }, label)));
	}
	// Home side panel: a row of small icon buttons that open menus, like a compact app toolbar.
	function renderSideTools() {
		const bar = document.querySelector('.todo-toolbar[data-scope="home"]');
		const pick = (key, value, label) => ({ label, active: String(view[key]) === String(value), run: () => { view[key] = value; saveView(); } });
		const filtered = view.board || view.label || view.priority !== "";
		const btn = (cls, title, icon, onclick, on) => el("button", { class: "side-tool " + cls + (on ? " on" : ""), type: "button", title, "aria-label": title, "data-menu-open": true, onclick }, icon);
		bar.replaceChildren(
			btn("st-more", t("moreOptions"), "⋯", (e) => H.menu(e.currentTarget, [
				{ icon: "▦", label: t("openTasksPage"), run: () => $("openTasksPage").click() },
				{ icon: "＋", label: t("newTask"), run: () => openEditor(null) },
				{ icon: "🗂", label: t("newBoard"), run: () => openBoard(null) },
				todos().some((x) => x.done) ? { icon: "🧹", label: t("clearDone"), run: clearDone } : null
			].filter(Boolean))),
			btn("st-eye", t("showCompleted"), view.showDone ? "◉" : "◎", () => { view.showDone = !view.showDone; saveView(); }, view.showDone),
			btn("st-filter", t("filter"), "⏷", (e) => H.menu(e.currentTarget, [
				{ icon: "", label: t("filterAll"), active: !filtered, run: () => { view.board = ""; view.label = ""; view.priority = ""; saveView(); } },
				"-",
				{ icon: "🗂", label: t("board"), sub: [pick("board", "", t("filterAll")), pick("board", "_none", t("defaultBoard")), ...boards().map((b) => pick("board", b.id, b.name))] },
				{ icon: "🏷", label: t("labels"), sub: [pick("label", "", t("filterAll")), ...labels().map((l) => pick("label", l.id, l.name))] },
				{ icon: "⚑", label: t("priority"), sub: [pick("priority", "", t("filterAll")), pick("priority", "3", t("prHigh")), pick("priority", "2", t("prMedium")), pick("priority", "1", t("prLow")), pick("priority", "0", t("prNone"))] }
			]), filtered),
			btn("st-sort", t("sortBy"), "⇅", (e) => H.menu(e.currentTarget, [
				{ icon: "⇅", label: t("sortBy"), sub: [pick("sort", "smart", t("sSmart")), pick("sort", "due", t("sDue")), pick("sort", "priority", t("sPriority")), pick("sort", "created", t("sCreated"))] },
				{ icon: "☰", label: t("groupBy"), sub: [pick("homeGroup", "due", t("gDue")), pick("homeGroup", "priority", t("gPriority")), pick("homeGroup", "label", t("gLabel")), pick("homeGroup", "board", t("gBoard")), pick("homeGroup", "none", t("gNone"))] }
			]))
		);
	}
	function renderToolbar(scope) {
		if (scope === "home") return renderSideTools();
		const bar = document.querySelector(`.todo-toolbar[data-scope="${scope}"]`);
		const groupKey = scope === "home" ? "homeGroup" : "group";
		const parts = [
			el("label", {}, el("span", {}, t("sortBy")), select(null, view.sort, [["smart", t("sSmart")], ["due", t("sDue")], ["priority", t("sPriority")], ["created", t("sCreated")]], (v) => { view.sort = v; saveView(); })),
			el("label", {}, el("span", {}, t("groupBy")), select(null, view[groupKey], [["due", t("gDue")], ["priority", t("gPriority")], ["label", t("gLabel")], ["board", t("gBoard")], ["none", t("gNone")]], (v) => { view[groupKey] = v; saveView(); }))
		];
		if (scope === "page") {
			parts.push(
				el("label", {}, el("span", {}, t("board")), select(null, view.board, [["", t("filterAll")], ["_none", t("defaultBoard")], ...boards().map((b) => [b.id, b.name])], (v) => { view.board = v; saveView(); })),
				el("label", {}, el("span", {}, t("labels")), select(null, view.label, [["", t("filterAll")], ...labels().map((l) => [l.id, l.name])], (v) => { view.label = v; saveView(); })),
				el("label", {}, el("span", {}, t("priority")), select(null, view.priority, [["", t("filterAll")], ["3", t("prHigh")], ["2", t("prMedium")], ["1", t("prLow")], ["0", t("prNone")]], (v) => { view.priority = v; saveView(); }))
			);
		}
		parts.push(el("label", { class: "check" }, el("input", { type: "checkbox", checked: view.showDone, onchange: (e) => { view.showDone = e.target.checked; saveView(); } }), " ", el("span", {}, t("showCompleted"))));
		const doneCount = todos().filter((x) => x.done).length;
		if (doneCount) parts.push(el("button", { class: "link-btn", type: "button", onclick: clearDone }, t("clearDone")));
		bar.replaceChildren(...parts);
	}
	function clearDone() {
		const done = todos().filter((x) => x.done);
		done.forEach((x) => Store.remove(x.id));
		H.toast(t("clearedN", { n: num(done.length) }), { run: () => done.forEach((x) => { const c = { ...x }; delete c.id; Store.add("todo", c); }) });
	}

	function renderHome() {
		const all = todos();
		const open = all.filter((x) => !x.done);
		$("todoCount").textContent = all.length ? t("todoCount", { done: num(all.length - open.length), total: num(all.length) }) : "";
		renderToolbar("home");
		$("todoList").replaceChildren(groupsEl(visible("home"), view.homeGroup, { draggable: false }));
	}

	function renderBoards() {
		const cols = [{ id: "", name: t("defaultBoard"), color: null }, ...boards()];
		const list = sorted(visible("page"));
		const body = el("div", { class: "kanban" });
		for (const b of cols) {
			const items = list.filter((x) => (b.id ? x.board === b.id : !boardById(x.board)));
			const col = el(
				"section",
				{
					class: "kcol",
					ondragover: (e) => { e.preventDefault(); col.classList.add("over"); },
					ondragleave: () => col.classList.remove("over"),
					ondrop: (e) => {
						e.preventDefault();
						col.classList.remove("over");
						const id = e.dataTransfer.getData("text/plain");
						const x = Store.get().items[id];
						if (x && (x.board || "") !== b.id) Store.update(id, { board: b.id || null });
					}
				},
				el(
					"div",
					{ class: "kcol-head", style: b.color ? `--c:${colorOf(b.color)}` : null },
					el("i", { class: "dot", style: `background:${b.color ? colorOf(b.color) : "var(--muted)"}` }),
					el("strong", { dir: "auto" }, b.name),
					el("span", { class: "muted small" }, num(items.length)),
					el("span", { class: "grow" }),
					b.id ? el("button", { class: "icon-btn small", type: "button", title: t("editBoard"), "aria-label": t("editBoard"), onclick: () => openBoard(b) }, "✎") : null
				),
				items.length ? el("ul", { class: "todo-list" }, ...items.map((x) => row(x, { draggable: true, showBoard: false }))) : el("p", { class: "empty small" }, t("emptyColumn")),
				el("button", { class: "link-btn kcol-add", type: "button", onclick: () => openEditor(null, { board: b.id || null }) }, "+ " + t("newTask"))
			);
			body.append(col);
		}
		return body;
	}
	function renderPage() {
		if (!$("tasksPage").open) return;
		document.querySelectorAll("#tasksPage .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.view === view.page));
		renderToolbar("page");
		$("tasksPageBody").replaceChildren(view.page === "boards" ? renderBoards() : el("div", { class: "page-list" }, groupsEl(visible("page"), view.group, { draggable: false })));
	}
	function render() {
		renderHome();
		renderPage();
	}

	/* ---------- task editor ---------- */
	let editing = null;
	let pickedLabels = new Set();
	function renderLabelPicker() {
		const box = $("taskLabels");
		const chips = labels().map((l) =>
			el("button", { type: "button", class: "lbl" + (pickedLabels.has(l.id) ? " on" : ""), style: `--c:${colorOf(l.color)}`, onclick: () => { pickedLabels.has(l.id) ? pickedLabels.delete(l.id) : pickedLabels.add(l.id); renderLabelPicker(); } }, l.name)
		);
		const input = el("input", { class: "lbl-new", dir: "auto", maxlength: "30", placeholder: t("newLabel") });
		input.addEventListener("keydown", (e) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			const name = input.value.trim();
			if (!name) return;
			const existing = labels().find((l) => l.name === name);
			const keys = Object.keys(COLORS);
			const l = existing || Store.add("label", { name, color: keys[labels().length % keys.length] });
			pickedLabels.add(l.id);
			renderLabelPicker();
			$("taskLabels").querySelector(".lbl-new").focus();
		});
		box.replaceChildren(...chips, input);
	}
	function openEditor(x, preset = {}) {
		editing = x || null;
		const v = x || { text: $("todoInput").value.trim(), priority: 0, ...preset };
		$("taskDialogTitle").textContent = t(x ? "editTask" : "newTask");
		$("taskTitle").value = v.text || "";
		$("taskDesc").value = v.desc || "";
		$("taskBoard").replaceChildren(el("option", { value: "" }, t("defaultBoard")), ...boards().map((b) => el("option", { value: b.id }, b.name)));
		$("taskBoard").value = v.board || "";
		$("taskPriority").value = String(v.priority || 0);
		$("taskDate").value = v.due || "";
		$("taskTime").value = v.time || "";
		$("taskRepeat").value = v.repeat || "";
		$("taskRemind").checked = !!v.remind;
		$("taskDelete").hidden = !x;
		$("taskError").hidden = true;
		pickedLabels = new Set((v.labels || []).filter(labelById));
		renderLabelPicker();
		$("taskDialog").showModal();
		$("taskTitle").focus();
	}
	$("taskForm").addEventListener("submit", (e) => {
		if (e.submitter && e.submitter.value !== "save") return;
		const text = $("taskTitle").value.trim();
		if (!text) return e.preventDefault();
		const remind = $("taskRemind").checked;
		if (remind && (!$("taskDate").value || !$("taskTime").value)) {
			e.preventDefault();
			$("taskError").textContent = t("remindNeedsTime");
			$("taskError").hidden = false;
			return;
		}
		const fields = {
			text,
			desc: $("taskDesc").value.trim(),
			board: $("taskBoard").value || null,
			priority: +$("taskPriority").value,
			due: $("taskDate").value || null,
			time: $("taskTime").value || null,
			repeat: $("taskRepeat").value || "",
			remind,
			labels: [...pickedLabels]
		};
		if (fields.repeat && !fields.due) fields.due = todayStr();
		if (editing) Store.update(editing.id, fields);
		else {
			Store.add("todo", { ...fields, done: false });
			$("todoInput").value = "";
		}
	});
	$("taskDelete").addEventListener("click", () => {
		if (!editing) return;
		const x = editing;
		$("taskDialog").close();
		removeTodo(x);
	});

	/* ---------- boards ---------- */
	let editingBoard = null;
	let boardColor = "blue";
	function renderSwatches() {
		$("boardColors").replaceChildren(
			...Object.entries(COLORS).map(([k, c]) => el("button", { type: "button", class: "sw" + (k === boardColor ? " on" : ""), style: `background:${c}`, title: t("c_" + k), "aria-label": t("c_" + k), onclick: () => { boardColor = k; renderSwatches(); } }))
		);
	}
	function openBoard(b) {
		editingBoard = b || null;
		$("boardDialogTitle").textContent = t(b ? "editBoard" : "addBoard");
		$("boardName").value = b ? b.name : "";
		boardColor = b ? b.color : Object.keys(COLORS)[boards().length % 10];
		$("boardDelete").hidden = !b;
		$("boardBulk").hidden = !b || !todos().some((x) => x.board === b.id);
		if (b) $("boardMoveTo").replaceChildren(el("option", { value: "" }, t("defaultBoard")), ...boards().filter((o) => o.id !== b.id).map((o) => el("option", { value: o.id }, o.name)));
		renderSwatches();
		$("boardDialog").showModal();
		$("boardName").focus();
	}
	$("boardForm").addEventListener("submit", (e) => {
		if (e.submitter && e.submitter.value !== "save") return;
		const name = $("boardName").value.trim();
		if (!name) return e.preventDefault();
		if (editingBoard) Store.update(editingBoard.id, { name, color: boardColor });
		else Store.add("board", { name, color: boardColor });
	});
	$("boardDelete").addEventListener("click", () => {
		const b = editingBoard;
		if (!b) return;
		const inside = todos().filter((x) => x.board === b.id);
		// Tasks are kept and moved to the default board.
		inside.forEach((x) => Store.update(x.id, { board: null }));
		Store.remove(b.id);
		$("boardDialog").close();
		H.toast(t("boardDeleted"), { run: () => { const nb = Store.add("board", { name: b.name, color: b.color, order: b.order }); inside.forEach((x) => Store.update(x.id, { board: nb.id })); } });
	});

	$("boardMove").addEventListener("click", () => {
		const b = editingBoard;
		if (!b) return;
		const to = $("boardMoveTo").value || null;
		const inside = todos().filter((x) => x.board === b.id);
		inside.forEach((x) => Store.update(x.id, { board: to }));
		$("boardDialog").close();
		H.toast(t("movedN", { n: num(inside.length) }), { run: () => inside.forEach((x) => Store.update(x.id, { board: b.id })) });
	});
	$("boardClear").addEventListener("click", () => {
		const b = editingBoard;
		if (!b) return;
		const inside = todos().filter((x) => x.board === b.id);
		inside.forEach((x) => Store.remove(x.id));
		$("boardDialog").close();
		H.toast(t("clearedN", { n: num(inside.length) }), { run: () => inside.forEach((x) => { const c = { ...x }; delete c.id; Store.add("todo", c); }) });
	});

	/* ---------- page & quick add ---------- */
	$("todoForm").addEventListener("submit", (e) => {
		e.preventDefault();
		const text = $("todoInput").value.trim();
		if (!text) return;
		Store.add("todo", { text, done: false, priority: 0, labels: [] });
		$("todoInput").value = "";
	});
	$("todoMore").addEventListener("click", () => openEditor(null));
	$("openTasksPage").addEventListener("click", () => {
		$("tasksPage").showModal();
		renderPage();
	});
	$("closeTasksPage").addEventListener("click", () => $("tasksPage").close());
	$("newTaskBtn").addEventListener("click", () => openEditor(null, { board: view.board && view.board !== "_none" ? view.board : null }));
	$("addBoardBtn").addEventListener("click", () => openBoard(null));
	document.querySelectorAll("#tasksPage .seg-btn").forEach((b) => b.addEventListener("click", () => { view.page = b.dataset.view; saveView(); }));

	/* ---------- reminders ---------- */
	let alarmTimer = null;
	function syncAlarms() {
		clearTimeout(alarmTimer);
		alarmTimer = setTimeout(async () => {
			const want = new Map();
			const now = Date.now();
			for (const x of todos()) {
				if (!x.remind || x.done || !x.due || !x.time) continue;
				const when = new Date(`${x.due}T${x.time}:00`).getTime();
				if (when > now) want.set("todo:" + x.id, when);
			}
			const existing = await chrome.alarms.getAll();
			for (const a of existing) if (a.name.startsWith("todo:") && (!want.has(a.name) || Math.abs(want.get(a.name) - a.scheduledTime) > 1000)) await chrome.alarms.clear(a.name);
			const have = new Set((await chrome.alarms.getAll()).map((a) => a.name));
			for (const [name, when] of want) if (!have.has(name)) chrome.alarms.create(name, { when });
		}, 500);
	}

	H.onRefresh(() => {
		render();
		syncAlarms();
	});
	window.Todos = { openEditor, COLORS };
})();
