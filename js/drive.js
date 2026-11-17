/* Google Drive sync.
 * Data lives in the signed-in person's own Drive, in the hidden "app data" folder
 * (scope drive.appdata): only this extension can see that file, and it cannot read
 * any of the person's other Drive files. Each Chrome profile uses its own Google account,
 * so every person gets their own copy. */
(function () {
	"use strict";
	const FILE_NAME = "hamyar-data.json";
	const API = "https://www.googleapis.com/drive/v3";
	const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
	const STATE_KEY = "hamyar_drive";

	let fileId = null;

	class DriveError extends Error {
		constructor(message, status) {
			super(message);
			this.status = status;
		}
	}

	async function getToken(interactive) {
		try {
			const r = await chrome.identity.getAuthToken({ interactive });
			const token = typeof r === "string" ? r : r && r.token;
			if (!token) throw new DriveError("no-token", 401);
			return token;
		} catch (e) {
			if (e instanceof DriveError) throw e;
			throw new DriveError(String((e && e.message) || e), 401);
		}
	}

	async function request(url, opts = {}, interactive = false, retried = false) {
		const token = await getToken(interactive);
		const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: "Bearer " + token } });
		if (res.status === 401 && !retried) {
			await chrome.identity.removeCachedAuthToken({ token });
			return request(url, opts, interactive, true);
		}
		if (!res.ok) throw new DriveError("Drive " + res.status + ": " + (await res.text()).slice(0, 200), res.status);
		return res;
	}

	async function findFile(interactive) {
		if (fileId) return fileId;
		const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
		const res = await request(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`, {}, interactive);
		const { files } = await res.json();
		fileId = files && files.length ? files[0].id : null;
		return fileId;
	}

	async function download(interactive) {
		const id = await findFile(interactive);
		if (!id) return null;
		const res = await request(`${API}/files/${id}?alt=media`, {}, interactive);
		try {
			return await res.json();
		} catch {
			return null; // damaged file: it will be overwritten by the next upload
		}
	}

	async function upload(data, interactive) {
		const body = JSON.stringify(data);
		const id = await findFile(interactive);
		if (id) {
			await request(`${UPLOAD}/files/${id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }, interactive);
			return;
		}
		const boundary = "hamyar" + Math.random().toString(36).slice(2);
		const meta = JSON.stringify({ name: FILE_NAME, parents: ["appDataFolder"], mimeType: "application/json" });
		const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
		const res = await request(`${UPLOAD}/files?uploadType=multipart&fields=id`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body: multipart }, interactive);
		fileId = (await res.json()).id;
	}

	async function getEmail() {
		try {
			const info = await chrome.identity.getProfileUserInfo({ accountStatus: "ANY" });
			return (info && info.email) || "";
		} catch {
			return "";
		}
	}

	const Drive = {
		DriveError,
		async isEnabled() {
			const r = await chrome.storage.local.get(STATE_KEY);
			return !!(r[STATE_KEY] && r[STATE_KEY].enabled);
		},
		async setEnabled(enabled, extra = {}) {
			const r = await chrome.storage.local.get(STATE_KEY);
			await chrome.storage.local.set({ [STATE_KEY]: { ...(r[STATE_KEY] || {}), enabled, ...extra } });
		},
		async lastSync() {
			const r = await chrome.storage.local.get(STATE_KEY);
			return (r[STATE_KEY] && r[STATE_KEY].lastSync) || 0;
		},
		getEmail,
		/** Pull, merge with local data, push the merged result. Returns the merged data. */
		async sync(local, interactive = false) {
			const remote = await download(interactive);
			const merged = remote ? window.Store.merge(local, remote) : window.Store.normalize(local);
			await upload(merged, interactive);
			await Drive.setEnabled(true, { lastSync: Date.now() });
			return merged;
		},
		async connect() {
			await getToken(true);
			fileId = null;
			return Drive.sync(window.Store.get(), true);
		},
		/** Stop syncing on this device. The copy in Drive stays where it is. */
		async disconnect() {
			try {
				const token = await getToken(false);
				await chrome.identity.removeCachedAuthToken({ token });
				await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), { method: "POST" }).catch(() => {});
			} catch {}
			fileId = null;
			await Drive.setEnabled(false);
		}
	};

	window.Drive = Drive;
})();
