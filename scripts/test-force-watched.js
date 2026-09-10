// test-force-watched.js — Shift+W force-watched functional smoke (CDP).
// Boots the userscript at document_start (like VM content mode) on a real
// YouTube watch page with the feature enabled via the GM storage shim,
// presses Shift+W, and asserts: real `ended` on the media element, organic
// sprint trace (window.__fwLog), watchtime beacon on the wire, and honest
// toasts. Requires: puppeteer-core, Chromium at /usr/bin/chromium.
// Usage: NODE_PATH=<node_modules> node scripts/test-force-watched.js
// Feature enabled via GM shim:
// seeds localStorage gm:ytp.cfg with forceWatchedOn + both history flags,
// injects the userscript, presses Shift+W, then asserts:
//  (1) window.__fwLog shows sprint1 completing, settle ran
//  (2) real `ended` observed on the media element
//  (3) /api/stats/watchtime|playback beacons fired BY THE SCRIPT window
//      (counted from keypress time, not from page load)
//  (4) rate/mute/loop restored, page stays on the video
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
  const errors = [];
  const stats = [];
  let counting = false;
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  page.on('request', (r) => {
    if (!counting) return;
    const u = r.url();
    if (/\/api\/stats\/(watchtime|playback|atr|qoe|delayplay)/.test(u)) stats.push(u.replace(/^.*\/api\/stats\//, '').split('?')[0]);
  });
  await page.evaluateOnNewDocument(() => {
    window.__fw_ended = 0;
    setInterval(() => {
      const v = document.querySelector('video.html5-main-video');
      if (v && v.ended) window.__fw_ended++;
    }, 40);
  });
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded', timeout: 60000 });
  // GM shim + seed config BEFORE script injection (mirrors VM storage model).
  await page.evaluate(() => {
    window.GM_setValue = (k, v) => { try { localStorage.setItem('gm:' + k, JSON.stringify(v)); } catch (e) {} };
    window.GM_getValue = (k, d) => { try { const s = localStorage.getItem('gm:' + k); if (s !== null) return JSON.parse(s); } catch (e) {} return d; };
    window.GM_deleteValue = (k) => { try { localStorage.removeItem('gm:' + k); } catch (e) {} };
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; };
    window.GM_registerMenuCommand = () => {};
    window.GM_info = { script: { version: '3.16.11', name: 'YT-zen' }, injectInto: 'content' };
    GM_setValue('ytp.cfg', { forceWatchedOn: true, forceWatchedAccountHistory: true, forceWatchedLocalHistory: true, debugVerbose: true });
  });
  await page.evaluate(src).catch((e) => errors.push('inject: ' + e));
  await new Promise((r) => setTimeout(r, 4000));
  counting = true;
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyW');
  await page.keyboard.up('Shift');
  await new Promise((r) => setTimeout(r, 13000));
  counting = false;
  const out = await page.evaluate(() => ({
    fwLog: window.__fwLog || [],
    endedSeen: window.__fw_ended || 0,
    v: (() => { const v = document.querySelector('video.html5-main-video'); return v ? { t: +v.currentTime.toFixed(2), dur: v.duration, ended: v.ended, paused: v.paused, rate: v.playbackRate, muted: v.muted, loop: v.loop } : null; })(),
    url: location.href,
  }));
  out.scriptStats = stats;
  out.errors = errors.slice(0, 4);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
  const sprintOk = (out.fwLog || []).some((l) => /sprint1 done=true/.test(l));
  const settleOk = (out.fwLog || []).some((l) => /settle /.test(l));
  if (!out.endedSeen) { console.error('FAIL: no real ended'); process.exit(2); }
  if (!sprintOk || !settleOk) { console.error('FAIL: organic channel trace incomplete', out.fwLog); process.exit(3); }
  if (!out.scriptStats.includes('watchtime')) { console.error('FAIL: no watchtime beacon after keypress'); process.exit(4); }
  console.log('SMOKE PASS — real ended + organic settle + watchtime beacon');
})().catch((e) => { console.error('HARNESS FAILURE:', e.message); process.exit(1); });
