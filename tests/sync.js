/* Google Drive round trip against a fake Drive: computer A fills in data and connects; computer B, a fresh
 * install that already made a choice of its own, connects and must get everything without duplicates.
 * Run: node tests/sync.js */
const { chromium } = require('playwright');
const path = require('path');
const ext = path.resolve(__dirname, '..');
let failed = 0;
const check = (name, ok, info) => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (ok ? '' : '  → ' + JSON.stringify(info))); if (!ok) failed++; };
let file = null; // { id, body }
async function device(name) {
  const ctx = await chromium.launchPersistentContext('', { headless: true, channel: 'chromium', args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`], viewport: { width: 1440, height: 900 } });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const id = sw.url().split('/')[2];
  await ctx.route(/^https?:\/\//, async (r) => {
    const req = r.request(), u = req.url(), m = req.method();
    if (u.includes('googleapis.com/drive/v3/files?')) return r.fulfill({ json: { files: file ? [{ id: file.id }] : [] } });
    if (u.includes('googleapis.com/drive/v3/files/') && u.includes('alt=media')) return r.fulfill({ body: file ? file.body : '{}', contentType: 'application/json' });
    if (u.includes('upload/drive/v3/files/') && m === 'PATCH') { file.body = req.postData(); return r.fulfill({ json: { id: file.id } }); }
    if (u.includes('upload/drive/v3/files?') && m === 'POST') { const b = req.postData(); const parts = b.split('\r\n\r\n'); file = { id: 'F1', body: parts[2].split('\r\n--')[0] }; return r.fulfill({ json: { id: 'F1' } }); }
    return r.abort();
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('kamyar_tour_done', '1'); localStorage.setItem('kamyar_setup_done', '1');
    localStorage.setItem('kamyar_brief_day', new Date().toISOString().slice(0, 10)); localStorage.setItem('kamyar_week_shown', 'x'); localStorage.setItem('kamyar_journal_nudge', 'x');
    try { Object.defineProperty(chrome.identity, 'getAuthToken', { value: async () => ({ token: 'fake' }), configurable: true, writable: true }); } catch (e) { console.log('patch fail', e.message); }
    try { Object.defineProperty(chrome.identity, 'getProfileUserInfo', { value: async () => ({ email: 'a@example.com' }), configurable: true, writable: true }); } catch {}
  });
  await page.goto(`chrome-extension://${id}/newtab.html`);
  await page.evaluate(async () => { await window.hamyarReady; });
  await page.waitForTimeout(500);
  return { ctx, page, errs, name };
}
(async () => {
  const A = await device('A');
  await A.page.evaluate(() => {
    Store.setSetting('lang', 'fa'); Store.setSetting('name', 'محمد'); Store.setSetting('city', { name: 'تهران', lat: 35.69, lon: 51.39, tz: 'Asia/Tehran' });
    Store.setSetting('widgets', { football: false }); Store.setSetting('care', { water: { on: false } }); Store.setSetting('salat', { on: true }); Store.setSetting('svcCustom', [{ id: 'my-1', title: 'کاری', items: [{ title: 'X', url: 'https://x.com' }] }]);
    Store.setSetting('feat', { tr: false }); Store.setSetting('boxAlpha', [40, 70]); Store.setSetting('wallBuiltin', 'b-fuji-night'); Store.setSetting('toolsOrder', ['journal', 'weather']); Store.setSetting('toolsWide', { worldclock: true }); Store.setSetting('svcOrder', ['ir-taxi', 'ir-search']); Store.setSetting('svcCols', 2); Store.setSetting('worldClocks', ['Asia/Tokyo']);
    Store.add('bookmark', { title: 'Digikala', url: 'https://www.digikala.com' }); Store.add('folder', { title: 'Work' });
    Store.add('todo', { text: 'T1' }); Store.add('note', { title: 'N1', text: 'hello' }); Store.add('event', { kind: 'birthday', title: 'Mum', date: '1970-03-05' });
    Store.add('goal', { title: 'Books', target: 10, done: 3 }); Store.add('journal', { date: '2026-11-18', lines: ['a', 'b', 'c'] }); Store.add('trip', { title: 'Trip', date: '2026-12-30' });
    Store.add('habit', { name: 'Run' });
  });
  const okA = await A.page.evaluate(async () => { try { await Drive.connect(); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
  await A.ctx.close();

  const B = await device('B');
  // fresh install B: the new-install defaults run first, then the person makes a choice, then connects.
  await B.page.evaluate(() => Store.setSetting('lang', 'en'));
  const okB = await B.page.evaluate(async () => { try { const m = await Drive.connect(); Store.replace(Store.merge(Store.get(), m), 'drive'); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
  await B.page.waitForTimeout(800);
  const r = await B.page.evaluate(() => ({
    lang: H.setting('lang'), name: H.setting('name'), city: (H.setting('city') || {}).name, widgets: H.setting('widgets'), care: H.setting('care'), salat: H.setting('salat'),
    svc: (H.setting('svcCustom') || []).length, feat: H.setting('feat'), boxAlpha: H.setting('boxAlpha'), localAlpha: Themes.boxAlpha(), wall: Themes.activeWall(), clocks: H.setting('worldClocks'), tools: H.setting('toolsOrder'), wide: document.querySelector('[data-widget="worldclock"]').classList.contains('wide'), svcFirst: (H.setting('svcOrder') || [])[0], svcCols: H.setting('svcCols'),
    bms: Store.list('bookmark').map((b) => b.title), types: ['folder', 'todo', 'note', 'event', 'goal', 'journal', 'trip', 'habit'].map((t) => t + ':' + Store.list(t).length).join(' ')
  }));
  console.log('Google Drive sync');
  check('computer A uploads', okA === 'ok' && !!file, okA);
  check('computer B downloads', okB === 'ok', okB);
  check('B keeps its own newer choice (language)', r.lang === 'en', r.lang);
  check('name, city and settings come across', r.name === 'محمد' && r.city === 'تهران' && r.salat && r.salat.on && r.feat && r.feat.tr === false && r.svc === 1 && String(r.clocks) === 'Asia/Tokyo', r);
  check('box opacity and wallpaper come across', String(r.localAlpha) === '40,70' && r.wall === 'b-fuji-night', [r.localAlpha, r.wall]);
  check('box layout comes across', String(r.tools).startsWith('journal,weather') && r.wide && r.svcFirst === 'ir-taxi' && r.svcCols === 2, r);
  check('every kind of item comes across', r.types === 'folder:1 todo:1 note:1 event:1 goal:1 journal:1 trip:1 habit:1', r.types);
  check('starter shortcuts are not doubled', r.bms.filter((x) => x === 'Google').length === 1 && r.bms.includes('Digikala'), r.bms);
  check('no page errors', !A.errs.length && !B.errs.length, [A.errs, B.errs]);
  // Round two: B changes and deletes something and saves; a third computer must get B's version.
  const okB2 = await B.page.evaluate(async () => {
    const t = Store.list('todo')[0]; Store.remove(t.id);
    Store.add('note', { title: 'From B', text: 'b' }); Store.setSetting('name', 'Mohammad');
    return 'ok';
  });
  await B.page.waitForTimeout(4500); // the page saves to Drive by itself a moment after a change
  await B.ctx.close();
  const C = await device('C');
  const okC = await C.page.evaluate(async () => { try { await H.driveConnect(); return 'ok'; } catch (e) { return 'ERR ' + e.message; } });
  await C.page.waitForTimeout(500);
  const c = await C.page.evaluate(() => ({ name: H.setting('name'), todos: Store.list('todo').length, notes: Store.list('note').map((n) => n.title).sort().join(','), habits: Store.list('habit').length }));
  check('changes from B reach a third computer', okB2 === 'ok' && okC === 'ok' && c.name === 'Mohammad' && c.notes === 'From B,N1' && c.habits === 1, [okB2, okC, c]);
  check('a deleted item stays deleted', c.todos === 0, c.todos);
  check('no page errors on the third computer', !C.errs.length, C.errs);
  await C.ctx.close();
  process.exit(failed ? 1 : 0);
})();
