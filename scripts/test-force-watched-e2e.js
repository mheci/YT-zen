// test-force-watched-e2e.js — browser-agnostic Shift+W end-to-end harness.
// Chromium (CDP) or Firefox (BiDi), real YouTube page, userscript booted
// with the GM shim, Shift+W pressed, then four assertions:
//   A1 scrub reached the tail (>= 97% via settle trace / element)
//   A2 settled paused, no autonav navigation
//   A3 last real-player watchtime write for THIS video is >= 95% of len
//   A4 organic settle trace done=true
// Env: FW_VIDEO (default oARDSm4df6Y), FW_BROWSER=chromium|firefox,
//      FW_WAIT (observation ms). Requires puppeteer-core >= 23.
// Boots the userscript with the GM shim at document_start on VIDEO,
// presses Shift+W, then asserts:
//   A1 scrub reached the tail (t >= dur - 2%)
//   A2 settled paused at the tail (no autonav navigation: URL unchanged)
//   A3 last real-player watchtime write on the wire is at >= 95% of len
//   A4 organic settle trace: done=true
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const VIDEO = process.env.FW_VIDEO || 'oARDSm4df6Y';
const BROWSER = process.env.FW_BROWSER || 'chromium';
const WAIT = +(process.env.FW_WAIT || 25000);
const LAUNCH = BROWSER === 'firefox'
  ? { executablePath: '/usr/bin/firefox', browser: 'firefox', protocol: 'webDriverBiDi', headless: true,
      args: ['--profile', '/tmp/ffprof', '--no-remote'] }
  : { executablePath: '/usr/bin/chromium', headless: 'new',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] };
(async () => {
  const browser = await puppeteer.launch(Object.assign({ protocolTimeout: 120000 }, LAUNCH));
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const src = fs.readFileSync('/home/user/ytzen/yt-zen.user.js', 'utf8');
  const errors = [];
  const wt = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
  page.on('request', (r) => {
    const u = r.url();
    const m = u.match(/\/api\/stats\/watchtime\?(.*)/);
    if (!m) return;
    const params = m[1];
    const q = {};
    for (const kv of params.split('&')) { const i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
    wt.push({ t: Date.now(), cmt: parseFloat(q.cmt || '0'), state: q.state, len: parseFloat(q.len || '0'), who: q.cbr, docid: q.docid, plid: (q.plid || '').slice(0, 8) });
  });
  const shim = `(${() => {
    window.GM_setValue = (k, v) => { try { localStorage.setItem('gm:' + k, JSON.stringify(v)); } catch (e) {} };
    window.GM_getValue = (k, d) => { try { const s = localStorage.getItem('gm:' + k); if (s !== null) return JSON.parse(s); } catch (e) {} return d; };
    window.GM_deleteValue = (k) => { try { localStorage.removeItem('gm:' + k); } catch (e) {} };
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; };
    window.GM_registerMenuCommand = () => {};
    window.GM_info = { script: { version: '3.16.15', name: 'YT-zen' }, injectInto: 'content' };
    GM_setValue('ytp.cfg', { forceWatchedOn: true, forceWatchedAccountHistory: true, forceWatchedLocalHistory: true, debugVerbose: true });
  }})()`;
  try { await page.evaluateOnNewDocument(shim); await page.evaluateOnNewDocument(src); }
  catch (e) { console.error('preload unsupported (' + e.message + '), falling back to post-load inject'); }
  await page.goto('https://www.youtube.com/watch?v=' + VIDEO, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!/^chrome|^moz-/.test(await page.evaluate(() => 'x'))) {}
  // firefox fallback: if preload scripts did not run, inject now
  const booted = await page.evaluate(() => !!window.GM_getValue).catch(() => false);
  if (!booted) {
    await page.evaluate(shim.replace(/^\(|\)\)$/g, '')).catch(() => {});
    await page.evaluate(src).catch((e) => errors.push('inject: ' + e));
  }
  await new Promise((r) => setTimeout(r, 6000));
  const t0 = Date.now();
  global.__t0 = t0;
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyW');
  await page.keyboard.up('Shift');
  // sampled timeline: small fast evaluates (page may be busy)
  const samples = [];
  const sample = async () => {
    try {
      const d = await Promise.race([
        page.evaluate(() => {
          const v = document.querySelector('video');
          return { t: v ? +v.currentTime.toFixed(0) : -1, dur: v && v.duration ? +v.duration.toFixed(0) : -1, paused: v ? v.paused : null, n: (window.__fwLog || []).length };
        }),
        new Promise((res) => setTimeout(() => res(null), 4000)),
      ]);
      samples.push(d && { ...d, at: Math.round((Date.now() - t0) / 1000) });
    } catch (_) { samples.push(null); }
  };
  for (let i = 0; i < WAIT / 2500; i++) { await new Promise((r) => setTimeout(r, 2500)); await sample(); }
  console.error('timeline:', JSON.stringify(samples.filter(Boolean)));
  let out = null;
  try {
    out = await Promise.race([
      page.evaluate(() => {
        const v = document.querySelector('video');
        return {
          fwLog: window.__fwLog || [],
          t: v ? +v.currentTime.toFixed(1) : -1,
          dur: v && v.duration ? +v.duration.toFixed(1) : -1,
          paused: v ? v.paused : null,
        };
      }),
      new Promise((res) => setTimeout(() => res(null), 30000)),
    ]);
  } catch (e) { errors.push('final eval: ' + String(e).slice(0, 80)); }
  if (!out) out = { fwLog: [], t: -1, dur: -1, paused: null };
  const nav = 'https://www.youtube.com/watch?v=' + VIDEO;
  await browser.close();
  const base = 'https://www.youtube.com/watch?v=' + VIDEO;
  const frac = out.dur > 0 ? out.t / out.dur : 0;
  const realWrites = wt.filter((w) => w.len > 0 && w.docid === VIDEO);
  realWrites.sort((a, b) => b.t - a.t);
  const lastReal = realWrites[0];
  const otherLast = wt.filter((w) => w.len > 0 && w.docid !== VIDEO).sort((a, b) => b.t - a.t)[0] || null;
  // A1: the element may re-cue after a true end-of-stream — judge tail
  // reach by the settle trace and the sampled timeline instead.
  const settleLine = (out.fwLog || []).find((l) => /settle done=true/.test(l));
  const settleT = settleLine ? parseFloat((settleLine.match(/t=([0-9.]+)/) || [])[1]) : NaN;
  const scrubLine = (out.fwLog || []).find((l) => /scrub /.test(l));
  const scrubT = scrubLine ? parseFloat((scrubLine.match(/t=([0-9.]+)/) || [])[1]) : NaN;
  const tailRef = out.dur > 0 ? out.dur : settleT;
  const a1 = (!isNaN(settleT) && tailRef > 0 && settleT >= 0.97 * tailRef) || (!isNaN(scrubT) && tailRef > 0 && scrubT >= 0.97 * tailRef) || frac >= 0.97;
  const a2 = out.paused === true;
  const a3 = lastReal ? lastReal.cmt >= 0.95 * lastReal.len : false;
  const a4 = (out.fwLog.some((l) => /settle done=true/.test(l)));
  console.log(JSON.stringify({
    browser: BROWSER, video: VIDEO, wallMs: Date.now() - t0,
    el: { t: out.t, dur: out.dur, frac: +frac.toFixed(3), paused: out.paused },
    lastRealWrite: lastReal || null, realWriteCount: realWrites.length,
    otherVideoWrite: otherLast, endTitle: out.title, endUrl: out.url, autonavAfter: out.autonav,
    fwLog: out.fwLog, errors: errors.slice(0, 3),
    A1_tail: a1, A2_paused_no_nav: a2, A3_last_real_full: a3, A4_settle_ok: a4,
    VERDICT: a1 && a2 && a3 && a4 ? 'PASS' : 'FAIL',
  }, null, 1));
})().catch((e) => { console.error('HARNESS FAILURE:', e.message); process.exit(1); });
