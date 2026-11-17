// Asks once for microphone access so voice search works on the new-tab page.
(function () {
	const $ = (id) => document.getElementById(id);
	document.title = t("micTitle");
	$("micTitle").textContent = t("micTitle");
	$("micText").textContent = t("micText");
	$("micBtn").textContent = t("micAllow");
	$("micBtn").addEventListener("click", async () => {
		try {
			const s = await navigator.mediaDevices.getUserMedia({ audio: true });
			s.getTracks().forEach((x) => x.stop());
			$("micText").textContent = t("micOk");
			$("micBtn").hidden = true;
			setTimeout(() => window.close(), 1500);
		} catch {
			$("micText").textContent = t("micDenied");
		}
	});
})();
