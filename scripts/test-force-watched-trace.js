// Beacon forensics: chronological dump of every /api/stats/* request around
// Shift+W — who fired it (script vs real player inferred by params), and
// what position/state the backend would end up recording.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const src = fs.readFileSync('/home/user/ytzen/yt-zen.user.js', 'utf8');
  const t0ref = { v: 0 };
  const rows = [];
  page.on('request', (r) => {
    const u = r.url();
    const m = u.match(/\/api\/stats\/(watchtime|playback|atr|qoe|delayplay)\?(.*)/);
    if (!m) return;
    const q = {};
    for (const kv of m[2].split('&')) { const i = kv.indexOf('='); if (i > 0) q[kv.slice(0, i)] = kv.slice(i + 1); }
    rows.push({
      t: t0ref.v ? Math.round(performanceNow() - t0ref.v) : null,
      kind: m[1],
      docid: q.docid, cpn: (q.cpn || '').slice(0, 8),
      cmt: q.cmt, et: q.et, st: q.st, len: q.len, state: q.state, of: (q.of || '').slice(0, 10), plid: (q.plid || '').slice(0, 8), cbr: q.cbr,
      rt: q.rt, lact: q.lact, el: q.el, hasOf: q.of ? 1 : 0, hasVt: q.vt ? 1 : 0, hasRtn: q.rtn ? 1 : 0,
    });
  });
  // performance.now inside node — use Date.now diff instead
  const now = () => Date.now();
  let base = 0;
  page.on('request', (r) => { if (!base) base = now(); rows.length && (rows[rows.length - 1].t = now() - base); });
  const shim = `(${() => {
    window.GM_setValue = (k, v) => { try { localStorage.setItem('gm:' + k, JSON.stringify(v)); } catch (e) {} };
    window.GM_getValue = (k, d) => { try { const s = localStorage.getItem('gm:' + k); if (s !== null) return JSON.parse(s); } catch (e) {} return d; };
    window.GM_deleteValue = (k) => { try { localStorage.removeItem('gm:' + k); } catch (e) {} };
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; };
    window.GM_registerMenuCommand = () => {};
    window.GM_info = { script: { version: '3.16.11', name: 'YT-zen' }, injectInto: 'content' };
    GM_setValue('ytp.cfg', { forceWatchedOn: true, forceWatchedAccountHistory: true, forceWatchedLocalHistory: true, debugVerbose: true });
  }})()`;
  await page.evaluateOnNewDocument(shim);
  await page.evaluateOnNewDocument(src);
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 5000));
  base = now();
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyW');
  await page.keyboard.up('Shift');
  await new Promise((r) => setTimeout(r, 16000));
  const fwLog = await page.evaluate(() => window.__fwLog || []);
  // human timing: rebaseline rows to keypress
  const out = rows.filter((r) => r.t !== null).map((r) => ({ ...r, t: r.t }));
  console.log(JSON.stringify({ fwLog, beacons: out }, null, 1).replace(/\}, \{/g, '},\n{'));
  await browser.close();
})().catch((e) => { console.error('HARNESS FAILURE:', e.message); process.exit(1); });
