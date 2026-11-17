// Applies the saved theme, wallpaper and text direction before first paint (extension pages forbid inline scripts).
(function () {
	try {
		window.Themes.apply(localStorage.getItem("hamyar_theme") || "dark", localStorage.getItem("hamyar_accent"));
		var l = localStorage.getItem("hamyar_lang") || (navigator.language || "fa").slice(0, 2);
		if (["fa", "en", "fr", "de"].indexOf(l) < 0) l = "fa";
		document.documentElement.lang = l;
		document.documentElement.dir = l === "fa" ? "rtl" : "ltr";
	} catch (e) {}
})();
