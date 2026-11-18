/* Notification strings for the background service worker (generated from i18n.js). */
const BG_STRINGS = {
 "fa": {
  "shotFail": "گرفتن عکس از این صفحه ممکن نشد",
  "notifFocusDone": "جلسه‌ی تمرکز تمام شد 🎉",
  "notifBreakNext": "وقت استراحت ({m} دقیقه)",
  "notifBreakDone": "استراحت تمام شد",
  "notifFocusNext": "آماده‌ی جلسه‌ی تمرکز بعدی؟",
  "notifTask": "یادآوری کار",
  "notifEvent": "یادآوری رویداد",
  "notifBirthday": "تولد {name} 🎂",
  "notifBirthdayAge": "تولد {name} ({n} سالگی) 🎂",
  "notifTimer": "زمان‌سنج تمام شد ⏰",
  "notifTimerMsg": "زمانی که تنظیم کرده بودید به پایان رسید.",
  "whenToday": "امروز",
  "whenTomorrow": "فردا",
  "whenInDays": "{n} روز دیگر"
 },
 "en": {
  "shotFail": "Couldn't capture this page",
  "notifFocusDone": "Focus session done 🎉",
  "notifBreakNext": "Time for a {m}-minute break",
  "notifBreakDone": "Break is over",
  "notifFocusNext": "Ready for the next focus session?",
  "notifTask": "Task reminder",
  "notifEvent": "Event reminder",
  "notifBirthday": "{name}'s birthday 🎂",
  "notifBirthdayAge": "{name}'s birthday (turns {n}) 🎂",
  "notifTimer": "Timer finished ⏰",
  "notifTimerMsg": "The time you set is up.",
  "whenToday": "Today",
  "whenTomorrow": "Tomorrow",
  "whenInDays": "In {n} days"
 },
 "fr": {
  "shotFail": "Impossible de capturer cette page",
  "notifFocusDone": "Session de concentration terminée 🎉",
  "notifBreakNext": "Place à une pause de {m} minutes",
  "notifBreakDone": "La pause est terminée",
  "notifFocusNext": "Prêt pour la prochaine session ?",
  "notifTask": "Rappel de tâche",
  "notifEvent": "Rappel d'événement",
  "notifBirthday": "Anniversaire de {name} 🎂",
  "notifBirthdayAge": "Anniversaire de {name} ({n} ans) 🎂",
  "notifTimer": "Minuteur terminé ⏰",
  "notifTimerMsg": "Le temps choisi est écoulé.",
  "whenToday": "Aujourd'hui",
  "whenTomorrow": "Demain",
  "whenInDays": "Dans {n} jours"
 },
 "de": {
  "shotFail": "Diese Seite konnte nicht aufgenommen werden",
  "notifFocusDone": "Fokuseinheit beendet 🎉",
  "notifBreakNext": "Zeit für {m} Minuten Pause",
  "notifBreakDone": "Pause vorbei",
  "notifFocusNext": "Bereit für die nächste Fokuseinheit?",
  "notifTask": "Aufgaben-Erinnerung",
  "notifEvent": "Terminerinnerung",
  "notifBirthday": "Geburtstag von {name} 🎂",
  "notifBirthdayAge": "Geburtstag von {name} (wird {n}) 🎂",
  "notifTimer": "Timer abgelaufen ⏰",
  "notifTimerMsg": "Die eingestellte Zeit ist um.",
  "whenToday": "Heute",
  "whenTomorrow": "Morgen",
  "whenInDays": "In {n} Tagen"
 }
};
async function bgT() {
	let lang = (await chrome.storage.local.get("hamyar_lang")).hamyar_lang || (navigator.language || "fa").slice(0, 2);
	if (!BG_STRINGS[lang]) lang = "fa";
	return (k, vars) => (BG_STRINGS[lang][k] || k).replace(/\{(\w+)\}/g, (_, x) => (vars && vars[x] != null ? vars[x] : ""));
}
