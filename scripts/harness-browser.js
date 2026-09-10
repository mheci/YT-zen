#!/usr/bin/env node
/*
 * Real-browser lifecycle harness for YT-zen (puppeteer-core + system Chromium).
 *
 * Scenarios:
 *   boot-watch          cold load of a watch page; first apply + SponsorBlock lookup
 *   boot-content        same in Violentmonkey-style isolated content world
 *   spa-nav             search -> click result (real SPA navigation); features survive
 *   delayed-shell       YouTube's app JS is delayed 6s; apply still happens after mount
 *   style-wipe          YouTube drops our styles; watchdog repairs them
 *   dashboard           menu command opens the dashboard (main + content worlds)
 *
 * Usage: node scripts/harness-browser.js [scenario...]
 * Exit code 0 iff every core assertion held (network-dependent SB evidence
 * is reported, not fatal).
 */
const { launch, inject, attachConsole, wait } = require("./browser-lib");

const WATCH = "https://www.youtube.com/watch?v=JQb9eGeclQw"; // known SB segments
const SEARCH = "https://www.youtube.com/results?search_query=lofi+hip+hop";

const baseSeed = {
  sponsorblockOn: true,
  sbSeekbar: true,
  sbToast: true,
  sbHud: true,
  forceWatchedOn: true,
  forceWatchedLocalHistory: true,
  forceWatchedAccountHistory: true,
  // CSS-emitting features so marker registration/repair can be asserted
  compactUI: true,
  denseVideoGridOn: true,
};
for (const cat of ["sponsor", "selfpromo", "interaction", "intro", "outro", "preview", "hook", "filler", "music_offtopic", "exclusive_access"]) {
  baseSeed["sb_" + cat + "_en"] = true;
  baseSeed["sb_" + cat + "_act"] = ["selfpromo", "interaction"].includes(cat) ? "full" : "skip";
}
baseSeed["sb_poi_highlight_en"] = true;
baseSeed["sb_poi_highlight_act"] = "poi";
baseSeed["sb_chapter_en"] = true;
baseSeed["sb_chapter_act"] = "chapter";

function cfgSeed(extra) {
  // GM key the synchronous config load reads (ytp.cfg is JSON with __ver/__ts)
  const cfg = Object.assign({ __ver: 1000, __ts: Date.now() }, baseSeed, extra || {});
  return { "ytp.cfg": JSON.stringify(cfg) };
}

async function newPage(browser, seed, vmContent, log) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setCookie({ name: "CONSENT", value: "PENDING+987", domain: ".youtube.com", path: "/" });
  const entries = attachConsole(page, log);
  await inject(page, { seed: seed || {}, vmContent: !!vmContent });
  page._entries = entries;
  // Network evidence log
  const reqs = [];
  page.on("request", (r) => {
    const u = r.url();
    if (/sponsor\.ajay\.app|\/api\/stats\/|videostats|youtubei\/v1\/player|pagead/.test(u)) {
      reqs.push({ t: Date.now(), url: u.slice(0, 260), method: r.method() });
    }
  });
  page._reqs = reqs;
  return page;
}

const PROBE_FN = `(() => {
  const styles = Array.from(document.querySelectorAll('style[id^="ytp-style-"],style[id^="ytp-zen-"],style#ytp-theme-engine-style'));
  return {
    loaded: !!window.__YTPLUS_LOADED__,
    applied: !!window.__zen_last_apply,
    prismReady: !!window.__PRISM_READY__,
    bfcacheReapplied: !!window.__zenBfcacheReapplied,
    markerCount: styles.length,
    dashStyle: !!document.getElementById("ytp-dash-style"),
    menuCommands: Object.keys(window.__zenMenu || {}),
  };
})()`;

async function stateProbe(page) {
  if (page.evalContent) {
    const r = await page.evalContent(PROBE_FN);
    if (r && typeof r === "object" && !String(r).startsWith("__EVAL_ERROR__")) return r;
    // Fallback: DOM-shared evidence only (isolated globals are not visible)
    const markerCount = await page.evaluate(() => document.querySelectorAll('style[id^="ytp-style-"],style[id^="ytp-zen-"]').length);
    return { loaded: true, applied: markerCount > 0, markerCount, menuCommands: [], prismReady: false };
  }
  return page.evaluate(PROBE_FN);
}

async function scenarioBootWatch(browser, vmContent) {
  const name = vmContent ? "boot-content" : "boot-watch";
  const log = (...a) => console.log(`[${name}]`, ...a);
  const page = await newPage(browser, cfgSeed(), vmContent, log);
  const t0 = Date.now();
  await page.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  let applied = false, probe = null;
  for (let i = 0; i < 100; i++) {
    await wait(250);
    probe = await stateProbe(page);
    if (probe.applied) { applied = true; break; }
  }
  await wait(4000); // allow SB lookup + segments
  probe = await stateProbe(page);
  const sbReqs = page._reqs.filter((r) => /sponsor\.ajay\.app/.test(r.url));
  const marks = await page.evaluate(() => document.querySelectorAll(".ytp-sb-mark").length);
  const errors = page._entries.filter((e) => e.type === "pageerror" || e.type === "error").map((e) => e.text);
  const zenErrors = errors.filter((t) => /zen|ytp|sponsor/i.test(t));
  const elapsed = Date.now() - t0;
  await page.close();
  const ok = applied && probe.loaded && probe.markerCount > 0;
  return { name, ok, applied, elapsed_ms: elapsed, markers: probe.markerCount, sbRequests: sbReqs.length, sbMarks: marks,
    menuCommands: probe.menuCommands, errors: zenErrors.slice(0, 5),
    note: sbReqs.length ? sbReqs[0].url.slice(0, 120) : "no sponsor requests observed" };
}

async function scenarioSpaNav(browser) {
  const name = "spa-nav";
  const log = (...a) => console.log(`[${name}]`, ...a);
  const page = await newPage(browser, cfgSeed(), false, log);
  await page.goto(SEARCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 80; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  const before = await stateProbe(page);
  // Find first real video result link and click it (genuine SPA navigation)
  const clicked = await page.evaluate(() => {
    const a = document.querySelector("ytd-video-renderer a#video-title, ytd-video-renderer a#thumbnail[href*='watch']");
    if (!a) return false;
    a.click();
    return true;
  });
  let navd = false;
  if (clicked) {
    for (let i = 0; i < 80; i++) {
      await wait(250);
      const onWatch = await page.evaluate(() => /\/watch\?v=/.test(location.href));
      const probe = await stateProbe(page);
      if (onWatch && probe.markerCount > 0) { navd = true; break; }
    }
  }
  await wait(3000);
  const after = await stateProbe(page);
  const url = page.url();
  // Count style markers duplicates: each registered style id must exist once
  const dupes = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("style[id]")).map((s) => s.id);
    const seen = new Set(); const d = new Set();
    for (const id of ids) (seen.has(id) ? d : seen).add(id);
    return d.size;
  });
  const errors = page._entries.filter((e) => e.type === "pageerror").map((e) => e.text);
  await page.close();
  const ok = clicked && navd && after.markerCount > 0 && dupes === 0;
  return { name, ok, clicked, navd, url, markersBefore: before.markerCount, markersAfter: after.markerCount, duplicateStyleIds: dupes, errors: errors.slice(0, 5) };
}

async function scenarioDelayedShell(browser) {
  const name = "delayed-shell";
  const log = (...a) => console.log(`[${name}]`, ...a);
  const page = await newPage(browser, cfgSeed(), false, log);
  // Hold the HTML document itself for 5s: at document-start body is null and
  // the shell must be detected once the server-rendered document parses.
  await page.setRequestInterception(true);
  let held = false;
  page.on("request", (req) => {
    if (req.resourceType() === "document" && !held) {
      held = true;
      setTimeout(() => req.continue().catch(() => {}), 5000);
    } else req.continue().catch(() => {});
  });
  const t0 = Date.now();
  await page.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  let appliedAt = null;
  for (let i = 0; i < 120; i++) {
    await wait(250);
    if ((await stateProbe(page)).applied) { appliedAt = Date.now() - t0; break; }
  }
  const probe = await stateProbe(page);
  await page.close();
  const ok = appliedAt !== null && appliedAt >= 4500;
  return { name, ok, appliedAt_ms: appliedAt, markers: probe.markerCount };
}

async function scenarioEarlyNav(browser) {
  // SPA navigation that lands while features are still applying on a slow
  // machine: every onNav handler must still run against the new page and the
  // SB engine must (re)initialize for the destination video.
  const name = "early-nav";
  const page = await newPage(browser, cfgSeed(), false, () => {});
  await page.goto(SEARCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 80; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  // Rapid-fire SPA navigations: click two results in quick succession.
  const ok = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("ytd-video-renderer a#video-title[href*='watch']"));
    return links.length >= 2;
  });
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("ytd-video-renderer a#video-title[href*='watch']"));
    if (links[0]) links[0].click();
  });
  await wait(600);
  await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("ytd-video-renderer a#video-title[href*='watch'],ytd-compact-video-renderer a[href*='watch']"));
    if (links[0]) links[0].click();
  });
  let settled = false;
  for (let i = 0; i < 80; i++) {
    await wait(250);
    const onWatch = await page.evaluate(() => /\/watch\?v=/.test(location.href));
    if (onWatch) { settled = true; break; }
  }
  await wait(4000); // allow SB lookup for final destination
  const sbForFinal = page._reqs.filter((r) => /sponsor\.ajay\.app/.test(r.url)).length;
  const probe = await stateProbe(page);
  const dupes = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll("style[id]")).map((s) => s.id);
    return ids.length - new Set(ids).size;
  });
  await page.close();
  return { name, ok: ok && settled && probe.markerCount > 0 && dupes === 0, linksFound: ok, settled, sbRequests: sbForFinal, dupes };
}

async function scenarioStyleWipe(browser) {
  const name = "style-wipe";
  const log = (...a) => console.log(`[${name}]`, ...a);
  const page = await newPage(browser, cfgSeed(), false, log);
  await page.goto(SEARCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 80; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  // YouTube re-render: rip out every YT-zen style node like a shell replacement.
  await page.evaluate(() => {
    document.querySelectorAll('style[id^="ytp-style-"],style[id^="ytp-zen-"]').forEach((n) => n.remove());
  });
  let wiped = await stateProbe(page);
  // Watchdog runs every 20s; allow one full interval plus slack.
  let repaired = false;
  for (let i = 0; i < 100; i++) {
    await wait(500);
    const probe = await stateProbe(page);
    if (probe.markerCount > 0) { repaired = true; break; }
  }
  await page.close();
  return { name, ok: repaired, markersBeforeWipe: wiped.markerCount, repaired };
}

async function scenarioDashboard(browser, vmContent) {
  const name = vmContent ? "dashboard-content" : "dashboard-main";
  const log = (...a) => console.log(`[${name}]`, ...a);
  const page = await newPage(browser, cfgSeed(), vmContent, log);
  await page.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 100; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  await wait(1500);
  const openExpr = `(async () => {
    const out = { menuPresent: false, opened: false, rows: 0, threw: null, fallback: false };
    try {
      const open = window.__zenMenu && window.__zenMenu["Open YT-zen dashboard"];
      out.menuPresent = typeof open === "function";
      if (open) { try { open(); } catch (e) { out.threw = String(e && e.message || e); } }
      if (!out.threw) {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const d = document.querySelector("aside.ytp-dash");
        out.opened = !!d && d.classList.contains("open");
      }
      if (!out.opened) {
        const fb = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window).__YTZEN_DASHBOARD__;
        out.fallback = typeof fb === "function";
        if (fb) { try { fb(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          const d = document.querySelector("aside.ytp-dash"); out.opened = !!d && d.classList.contains("open"); } catch (e) { out.threw = String(e && e.message || e); } }
      }
    } catch (e) { out.threw = String(e && e.message || e); }
    return out;
  })()`;
  const result = page.evalContent ? await page.evalContent(openExpr) : await page.evaluate(openExpr);
  const errors = page._entries.filter((e) => e.type === "pageerror").map((e) => e.text);
  await page.close();
  return Object.assign({ name, ok: result.opened && !result.threw }, result, { errors: errors.slice(0, 5) });
}

async function main() {
  const wanted = process.argv.slice(2);
  const browser = await launch();
  const all = [
    ["boot-watch", () => scenarioBootWatch(browser, false)],
    ["boot-content", () => scenarioBootWatch(browser, true)],
    ["spa-nav", () => scenarioSpaNav(browser)],
    ["early-nav", () => scenarioEarlyNav(browser)],
    ["delayed-shell", () => scenarioDelayedShell(browser)],
    ["style-wipe", () => scenarioStyleWipe(browser)],
    ["dashboard-main", () => scenarioDashboard(browser, false)],
    ["dashboard-content", () => scenarioDashboard(browser, true)],
  ];
  const results = [];
  for (const [n, fn] of all) {
    if (wanted.length && !wanted.includes(n)) continue;
    try {
      const r = await fn();
      results.push(r);
      console.log(JSON.stringify(r));
    } catch (e) {
      results.push({ name: n, ok: false, fatal: String(e && e.stack || e) });
      console.log(JSON.stringify({ name: n, ok: false, fatal: String(e && e.message || e) }));
    }
  }
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log("\nSUMMARY " + (results.length - failed.length) + "/" + results.length + " passed");
  for (const r of results) console.log((r.ok ? "PASS" : "FAIL") + "  " + r.name);
  process.exit(failed.length ? 2 : 0);
}
main().catch((e) => { console.error(e); process.exit(3); });
