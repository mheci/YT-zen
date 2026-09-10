// Adversarial: simulate the Firefox content-mode Xray failure —
// getPlayerResponse() on the player API throws the exact error from the
// user's console. The script must STILL: stash signatures, fire signed
// qt beacons, resolve templates from the page window, park at the tail.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: 'new',
    protocolTimeout: 120000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  const src = fs.readFileSync('/home/user/ytzen/yt-zen.user.js', 'utf8');
  const wt = [];
  page.on('request', (r) => {
    const m = r.url().match(/\/api\/stats\/watchtime\?(.*)/);
    if (!m) return;
    const q = {};
    const params = m[1];
    for (const kv of params.split('&')) { const i = kv.indexOf('='); q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
    wt.push({ cmt: parseFloat(q.cmt || 0), state: q.state, of: (q.of || '').slice(0, 8), cbr: q.cbr, docid: q.docid });
  });
  const shim = `(${() => {
    window.GM_setValue = (k, v) => { try { localStorage.setItem('gm:' + k, JSON.stringify(v)); } catch (e) {} };
    window.GM_getValue = (k, d) => { try { const s = localStorage.getItem('gm:' + k); if (s !== null) return JSON.parse(s); } catch (e) {} return d; };
    window.GM_deleteValue = (k) => { try { localStorage.removeItem('gm:' + k); } catch (e) {} };
    window.GM_addStyle = (css) => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; };
    window.GM_registerMenuCommand = () => {};
    window.GM_xmlhttpRequest = (o) => { fetch(o.url).catch(() => {}); };
    window.GM_info = { script: { version: '3.16.19', name: 'YT-zen' }, injectInto: 'content' };
    GM_setValue('ytp.cfg', { forceWatchedOn: true, forceWatchedAccountHistory: true, forceWatchedLocalHistory: true, debugVerbose: true });
    // POISON: once the player exists, make getPlayerResponse throw the
    // exact Xray error from the user's Firefox console.
    const poison = () => {
      const mp = document.getElementById('movie_player');
      if (mp && !mp.__poisoned) {
        try {
          Object.defineProperty(mp, 'getPlayerResponse', { value() { throw new Error('Not allowed to define cross-origin object as property on [Object] or [Array] XrayWrapper'); }, configurable: true });
          mp.__poisoned = 1;
        } catch (e) {}
      } else setTimeout(poison, 200);
    };
    poison();
  }})()`;
  await page.evaluateOnNewDocument(shim);
  await page.evaluateOnNewDocument(src);
  await page.goto('https://www.youtube.com/watch?v=HsLd7p9THL4', { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyW');
  await page.keyboard.up('Shift');
  await new Promise((r) => setTimeout(r, 15000));
  const out = await page.evaluate(() => {
    const v = document.querySelector('video');
    return { fwLog: window.__fwLog || [], t: v ? +v.currentTime.toFixed(1) : -1, dur: v && v.duration ? +v.duration.toFixed(1) : -1, paused: v ? v.paused : null };
  });
  await browser.close();
  const ours = wt.filter((w) => w.docid === 'HsLd7p9THL4');
  const signed = ours.filter((w) => w.of && w.of !== 'MS3lEPwE');
  const hardcoded = ours.filter((w) => w.of === 'MS3lEPwE');
  const last = ours[ours.length - 1] || null;
  const parked = out.fwLog.some((l) => /settle done=true/.test(l));
  console.log(JSON.stringify({
    el: out, realWrites: ours.length, signed, hardcoded: hardcoded.length,
    lastWrite: last, parked,
    VERDICT: parked && signed.length > 0 && hardcoded.length === 0 ? 'PASS (Xray-poisoned environment handled)' : 'FAIL',
  }, null, 1));
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
