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

async function newPage(browser, seed, vmContent, log, drop) {
  // Fresh incognito context per scenario: pages in the default context share
  // localStorage, and a previous scenario's saved ytp.cfg (bumped __ver) would
  // otherwise outrank the freshly seeded GM config on the next scenario.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setCookie({ name: "CONSENT", value: "PENDING+987", domain: ".youtube.com", path: "/" });
  const _close = page.close.bind(page);
  page.close = async () => { try { await _close(); } finally { try { await ctx.close(); } catch (_) {} } };
  const entries = attachConsole(page, log);
  await inject(page, { seed: seed || {}, vmContent: !!vmContent, drop: drop || {} });
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
  // Find first real video result link and click it (genuine SPA navigation).
  // Retry briefly: under full-suite load the search grid hydrates slowly.
  let clicked = false;
  for (let i = 0; i < 30 && !clicked; i++) {
    clicked = await page.evaluate(() => {
      const a = document.querySelector("ytd-video-renderer a#video-title, ytd-video-renderer a#thumbnail[href*='watch']");
      if (!a) return false;
      a.click();
      return true;
    });
    if (!clicked) await wait(250);
  }
  let navd = false;
  if (clicked) {
    for (let i = 0; i < 100; i++) {
      await wait(250);
      const onWatch = await page.evaluate(() => /\/watch\?v=/.test(location.href));
      const probe = await stateProbe(page);
      if (onWatch && probe.markerCount > 0) { navd = true; break; }
    }
  }
  await wait(1500);
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
  // Wait until at least two results are actually rendered (search hydration
  // can lag badly under full-suite CPU load).
  let hrefs = [];
  for (let i = 0; i < 80 && hrefs.length < 2; i++) {
    hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll("ytd-video-renderer a#video-title[href*='watch']")).map((a) => a.href));
    if (hrefs.length < 2) await wait(250);
  }
  const ok = hrefs.length >= 2;
  // Rapid-fire SPA navigations: with two hrefs captured, click two results
  // in quick succession. Under full-suite load the first SPA transition can
  // take seconds; re-query resiliently instead of assuming the search DOM is
  // still mounted 600ms later.
  const vidOf = (href) => { try { return new URL(href).searchParams.get("v"); } catch (_) { return ""; } };
  // Click the preferred vid; if it has unmounted (search grid replaced by the
  // watch page), click the first available result whose vid differs from the
  // one we are leaving. Returns the vid navigated to, or "" after timeout.
  const clickHref = async (preferredVid, excludeVid, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const clicked = await page.evaluate(([pref, excl]) => {
        const vids = (a) => { try { return new URL(a.href).searchParams.get("v"); } catch (_) { return ""; } };
        const links = Array.from(document.querySelectorAll(
          "ytd-video-renderer a#video-title[href*='watch'],ytd-compact-video-renderer a[href*='watch'],yt-lockup-view-model a[href*='watch']"));
        const hit = links.find((a) => vids(a) === pref)
          || links.find((a) => vids(a) && vids(a) !== excl);
        if (hit) { const v = vids(hit); hit.click(); return v; }
        return "";
      }, [preferredVid, excludeVid]);
      if (clicked) return clicked;
      await wait(200);
    }
    return "";
  };
  const waitForVid = async (targetVid, timeoutMs, differentFrom = null) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cur = await page.evaluate(() => location.href);
      if (/\/watch\?v=/.test(cur)) {
        const v = vidOf(cur);
        if ((!targetVid || v === targetVid) && (!differentFrom || v !== differentFrom)) return true;
      }
      await wait(200);
    }
    return /\/watch\?v=/.test(await page.evaluate(() => location.href));
  };
  const firstVid = vidOf(hrefs[0]);
  await clickHref(firstVid, null, 8000);
  await waitForVid(firstVid, 15000);
  await wait(600); // overlap the second nav with features still applying
  // The second pre-captured search result may not survive the transition;
  // accept any sidebar result different from the first destination.
  await clickHref(vidOf(hrefs[1]), firstVid, 6000);
  const settled = await waitForVid(null, 20000, firstVid);
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

async function scenarioSeekbarMarks(browser) {
  // Headless signed-out playback is gated (video.duration stays 0), which
  // legitimately suppresses seekbar marks in production. Here we stub the
  // sponsor.ajay.app response and video.duration to verify the full
  // lookup -> normalize -> render pipeline creates correctly positioned
  // colored marks inside .ytp-progress-list.
  const name = "seekbar-marks";
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.setCookie({ name: "CONSENT", value: "PENDING+987", domain: ".youtube.com", path: "/" });
  attachConsole(page, () => {});
  const VID = "JQb9eGeclQw";
  const segs = [
    { UUID: "mark-1", segment: [60, 90], category: "sponsor", actionType: "skip", votes: 10 },
    { UUID: "mark-2", segment: [300, 320], category: "intro", actionType: "skip", votes: 5 },
    { UUID: "mark-3", segment: [500, 500], category: "poi_highlight", actionType: "poi", votes: 8 },
  ];
  await page.setRequestInterception(true);
  const safeRespond = (req, payload) => { try { return req.respond(payload); } catch (_) {} return Promise.resolve(); };
  const safeContinue = (req) => { try { return req.continue(); } catch (_) {} return Promise.resolve(); };
  page.on("request", (req) => {
    const u = req.url();
    if (u.includes("sponsor.ajay.app/api/skipSegments")) {
      const body = /\/skipSegments\/[0-9a-f]{4}/.test(u) ? [{ videoID: VID, segments: segs }] : segs;
      // Cross-origin page-fetch fallback requires CORS headers (the real
      // sponsor.ajay.app sends Access-Control-Allow-Origin: *). Aborted
      // duplicate-plan requests reject respond(); ignore those.
      return safeRespond(req, {
        status: 200,
        contentType: "application/json",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify(body),
      });
    }
    if (u.includes("sponsor.ajay.app")) {
      return safeRespond(req, { status: 200, headers: { "Access-Control-Allow-Origin": "*" }, body: "" });
    }
    return safeContinue(req);
  });
  await inject(page, { seed: cfgSeed(), vmContent: false });
  await page.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 100; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  // Stub duration once the player/video element exists.
  let stubbed = false;
  for (let i = 0; i < 60 && !stubbed; i++) {
    stubbed = await page.evaluate((dur) => {
      const v = document.querySelector("video");
      if (!v) return false;
      try { Object.defineProperty(v, "duration", { configurable: true, get: () => dur }); } catch (_) {}
      v.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
      v.dispatchEvent(new Event("timeupdate", { bubbles: true }));
      return true;
    }, 600);
    if (!stubbed) await wait(250);
  }
  // Re-dispatch periodically and also let the 3s seekbar watchdog render.
  let out = { marks: 0, positioned: 0, inList: false, colors: [], stubbed, segCount: 0 };
  for (let i = 0; i < 48; i++) {
    await wait(500);
    await page.evaluate(() => {
      const v = document.querySelector("video");
      if (v) v.dispatchEvent(new Event("timeupdate", { bubbles: true }));
    });
    out = await page.evaluate(() => {
      const marks = Array.from(document.querySelectorAll(".ytp-sb-mark"));
      const list = document.querySelector(".ytp-progress-list,.ytp-progress-bar");
      return {
        marks: marks.length,
        positioned: marks.filter((m) => /left:\s*[\d.]+%/.test(m.style.cssText) && /width:\s*[\d.]+%/.test(m.style.cssText)).length,
        inList: !!(list && marks.every((m) => list.contains(m))),
        colors: marks.map((m) => m.style.background).slice(0, 5),
      };
    });
    if (out.marks >= 2) break;
  }
  await page.close();
  const ok = stubbed && out.marks >= 2 && out.positioned >= 2 && out.inList;
  return { name, ok, stubbed, marks: out.marks, positioned: out.positioned, inList: out.inList, colors: out.colors };
}

async function scenarioAioBundles(browser) {
  // AIO cards: (1) flipping a master enrolls members once, (2) a member
  // switched off afterwards is never forced back by re-apply, (3) every
  // member control is reachable inside the card (members are hidden cards),
  // (4) the three legacy _bundle cards are gone.
  const name = "aio-bundles";
  const seed = cfgSeed({ aioPlayerToolsOn: true, aioShortsCleanupOn: false });
  const page = await newPage(browser, seed, false, () => {});
  await page.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 100; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  const readCfg = () => page.evaluate(() => {
    const raw = typeof GM_getValue === "function" ? GM_getValue("ytp.cfg", null) : null;
    try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
  });
  // AIO cards register late in the applyAll batches; poll instead of sleeping.
  let cfg0 = null;
  for (let i = 0; i < 60; i++) {
    cfg0 = await readCfg();
    if (cfg0 && cfg0.aioPlayerToolsOnEnrolled === true) break;
    await wait(250);
  }
  const memberKeys = ["copyTimestampButtonOn", "copyVideoInfoButtonOn", "openTranscriptButtonOn",
    "videoNotesOn", "channelNotesOn", "chapterButtonsOn", "chapterHotkeysOn"];
  const afterBoot = {
    enrolled: !!(cfg0 && cfg0.aioPlayerToolsOnEnrolled),
    membersOn: cfg0 ? memberKeys.every((k) => cfg0[k] === true) : false,
    shortsUntouched: cfg0
      ? ["redirectShortsOn", "shortsAutoMuteOn", "shortsHideCommentsOn"].every((k) => !cfg0[k])
      : false,
  };

  // Open dashboard and inspect the AIO cards.
  const ui = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const opener = window.__zenMenu && window.__zenMenu["Open YT-zen dashboard"];
    if (opener) opener();
    // Cards render in chunks (20 immediately, then 12 per frame); poll for
    // all six AIO cards rather than racing the render queue.
    let dash = null;
    for (let i = 0; i < 60; i++) {
      dash = document.querySelector("aside.ytp-dash");
      if (dash && dash.querySelectorAll(".ytp-card[data-feat^='aio-']").length >= 6) break;
      await sleep(100);
    }
    if (!dash) return { opened: false };
    const aioCards = Array.from(dash.querySelectorAll(".ytp-card")).filter((c) => {
      const feat = c.dataset.feat || "";
      return feat.startsWith("aio-");
    });
    const oldBundles = dash.querySelectorAll('[data-feat$="-bundle"]').length;
    // Player tools card must expose every member as a checkbox + the master
    const playerCard = aioCards.find((c) => c.dataset.feat === "aio-player-tools");
    const memberInputs = playerCard
      ? memberKeysCheck(playerCard)
      : [];
    function memberKeysCheck(card) {
      return ["copyTimestampButtonOn", "copyVideoInfoButtonOn", "openTranscriptButtonOn",
        "videoNotesOn", "channelNotesOn", "chapterButtonsOn", "chapterHotkeysOn"]
        .map((k) => !!card.querySelector('input[type="checkbox"][data-key="' + k + '"]'));
    }
    const commentCard = aioCards.find((c) => c.dataset.feat === "aio-comment-cleanup");
    const commentSlider = commentCard
      ? !!commentCard.querySelector('input[type="range"][data-key="collapseLongCommentChars"]')
      : false;
    const feedCard = aioCards.find((c) => c.dataset.feat === "aio-feed-cleanup");
    const preferOriginalRow = feedCard
      ? !!feedCard.querySelector('input[type="checkbox"][data-key="hideAutoDubbedPreferOriginal"]')
      : false;
    // Standalone member cards whose surface is now exclusively the AIO card.
    const hiddenStandalones = ["dense-video-grid", "remove-redirect-urls",
      "shorten-share-url", "block-yt-ai", "hide-auto-dubbed",
      "feed-card-filters-bundle", "playlist-tweaks-bundle", "comment-tweaks-bundle"]
      .map((id) => !dash.querySelector('.ytp-card[data-feat="' + id + '"]'));
    return {
      opened: true,
      aioCount: aioCards.length,
      oldBundles,
      memberRows: memberInputs,
      allMemberRows: memberInputs.every(Boolean),
      commentSlider,
      preferOriginalRow,
      hiddenStandalonesGone: hiddenStandalones.every(Boolean),
    };
  });

  // Turn a member off, re-apply the bundle, and assert it stays off
  // (one-time enrollment, not a perpetual force).
  const stickResult = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const read = () => JSON.parse(GM_getValue("ytp.cfg", "{}"));
    const dash = document.querySelector("aside.ytp-dash");
    const card = Array.from(dash.querySelectorAll(".ytp-card"))
      .find((c) => c.dataset.feat === "aio-player-tools");
    const cb = card.querySelector('input[type="checkbox"][data-key="copyTimestampButtonOn"]');
    cb.click();
    // Wait until the opt-out is persisted (600ms save debounce, allow load).
    for (let i = 0; i < 40 && read().copyTimestampButtonOn !== false; i++) await sleep(100);
    window.__YTPLUS_ENGINE__.apply("aio-player-tools");
    await sleep(400);
    const cfg = read();
    return { off: cfg.copyTimestampButtonOn === false, enrolled: cfg.aioPlayerToolsOnEnrolled === true };
  });
  const memberSticks = stickResult.off && stickResult.enrolled;

  // Re-enrollment cycle: master OFF disarms the flag WITHOUT touching any
  // member; master ON again forces any member the user switched off back on.
  const cycle = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const read = () => JSON.parse(GM_getValue("ytp.cfg", "{}"));
    const dash = document.querySelector("aside.ytp-dash");
    const card = Array.from(dash.querySelectorAll(".ytp-card"))
      .find((c) => c.dataset.feat === "aio-player-tools");
    const box = (key) => card.querySelector('.ytp-head input[type="checkbox"][data-key="' + key + '"]')
      || card.querySelector('input[type="checkbox"][data-key="' + key + '"]');
    const master = box("aioPlayerToolsOn");
    master.click(); // off -> flag disarmed
    for (let i = 0; i < 40 && read().aioPlayerToolsOnEnrolled !== false; i++) await sleep(100);
    const off = read();
    const disarmed = off.aioPlayerToolsOnEnrolled === false
      && off.chapterButtonsOn === true // members are NOT switched off with master
      && off.copyTimestampButtonOn === false; // user opt-out preserved
    master.click(); // on -> re-enrollment should restore the opted-out member
    for (let i = 0; i < 40 && read().copyTimestampButtonOn !== true; i++) await sleep(100);
    await sleep(300);
    const on = read();
    const reEnrolled = on.aioPlayerToolsOnEnrolled === true
      && on.copyTimestampButtonOn === true
      && memberKeysCheck(on);
    function memberKeysCheck(cfg) {
      return ["copyTimestampButtonOn", "copyVideoInfoButtonOn", "openTranscriptButtonOn",
        "videoNotesOn", "channelNotesOn", "chapterButtonsOn", "chapterHotkeysOn"]
        .every((k) => cfg[k] === true);
    }
    return { disarmed, reEnrolled };
  });

  // Compact bundle: the tri-state "tighter theme spacing" member must behave
  // like every other member - unchecking it must survive a re-apply (the
  // force-on is allowed only during the one-time enrollment).
  const themeMember = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const read = () => JSON.parse(GM_getValue("ytp.cfg", "{}"));
    const dash = document.querySelector("aside.ytp-dash");
    const card = Array.from(dash.querySelectorAll(".ytp-card"))
      .find((c) => c.dataset.feat === "aio-compact-dense");
    if (!card) return false;
    const cb = card.querySelector('input[type="checkbox"][data-key="themeCompactOn"]');
    if (!cb || read().themeCompactOn !== true) return false;
    // Arm the compact bundle first (enrollment runs once).
    const master = card.querySelector('.ytp-head input[type="checkbox"][data-key="aioCompactDenseOn"]')
      || card.querySelector('input[type="checkbox"][data-key="aioCompactDenseOn"]');
    master.click();
    for (let i = 0; i < 40 && read().aioCompactDenseOnEnrolled !== true; i++) await sleep(100);
    // Then opt out of the theme member and re-apply; it must stay off.
    cb.click();
    for (let i = 0; i < 40 && read().themeCompactOn !== false; i++) await sleep(100);
    window.__YTPLUS_ENGINE__.apply("aio-compact-dense");
    await sleep(400);
    return read().themeCompactOn === false && read().aioCompactDenseOn === true;
  });

  await page.close();

  // Persistence across boot: a previously enrolled bundle with one member
  // explicitly switched off must NOT re-force that member at startup
  // (regression guard: Enrolled flags must survive the config schema filter).
  const persistSeed = { "ytp.cfg": JSON.stringify({
    __ver: 1000, __ts: Date.now(),
    aioPlayerToolsOn: true, aioPlayerToolsOnEnrolled: true,
    copyTimestampButtonOn: false,
    copyVideoInfoButtonOn: true, openTranscriptButtonOn: true,
    videoNotesOn: true, channelNotesOn: true,
    chapterButtonsOn: true, chapterHotkeysOn: true,
  }) };
  const p2 = await newPage(browser, persistSeed, false, () => {});
  await p2.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  let persisted = null;
  for (let i = 0; i < 60; i++) {
    await wait(300);
    persisted = await p2.evaluate(() => {
      const g = JSON.parse(GM_getValue("ytp.cfg", "{}"));
      return { ver: g.__ver, enr: g.aioPlayerToolsOnEnrolled, ts: g.copyTimestampButtonOn, vi: g.copyVideoInfoButtonOn };
    });
    if (persisted.ver !== 1000) break;
  }
  await p2.close();
  const persistOk = persisted && persisted.enr === true && persisted.ts === false && persisted.vi === true;

  const ok = afterBoot.enrolled && afterBoot.membersOn && afterBoot.shortsUntouched
    && ui.opened && ui.aioCount === 6 && ui.oldBundles === 0
    && ui.allMemberRows && ui.commentSlider && ui.preferOriginalRow
    && ui.hiddenStandalonesGone && memberSticks
    && cycle.disarmed && cycle.reEnrolled && persistOk && themeMember;
  return { name, ok, afterBoot, aioCount: ui.aioCount, oldBundles: ui.oldBundles,
    memberRows: ui.memberRows, commentSlider: ui.commentSlider,
    preferOriginalRow: ui.preferOriginalRow, hiddenStandalonesGone: ui.hiddenStandalonesGone,
    memberSticks, disarmed: cycle.disarmed, reEnrolled: cycle.reEnrolled,
    persistOk: !!(persisted && persistOk), persisted };
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

async function scenarioDashboard(browser, vmContent, drop) {
  const name = drop && drop.addStyle
    ? "dashboard-content-strictvm"
    : (vmContent ? "dashboard-content" : "dashboard-main");
  const log = (...a) => console.log(`[${name}]`, ...a);
  const page = await newPage(browser, cfgSeed(), vmContent, log, drop);
  await page.goto(WATCH, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (let i = 0; i < 100; i++) { await wait(250); if ((await stateProbe(page)).applied) break; }
  await wait(1500);
  const openExpr = `(async () => {
    const out = { menuPresent: false, opened: false, cards: 0, toggles: 0, threw: null, fallback: false,
      dashCss: false, dashCssIsStyle: false, addStyleMissing: (typeof GM_addStyle === "undefined") };
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
      if (out.opened) {
        const d = document.querySelector("aside.ytp-dash");
        out.cards = d.querySelectorAll(".ytp-card").length;
        out.toggles = d.querySelectorAll('input[type="checkbox"]').length;
        const marker = document.getElementById("ytp-dash-style");
        out.dashCss = !!marker;
        // The raw <style> fallback must carry the actual CSS; the manager
        // meta marker never does.
        out.dashCssIsStyle = !!marker && marker.tagName === "STYLE" && marker.textContent.length > 1000;
      }
    } catch (e) { out.threw = String(e && e.message || e); }
    return out;
  })()`;
  const result = page.evalContent ? await page.evalContent(openExpr) : await page.evaluate(openExpr);
  const errors = page._entries.filter((e) => e.type === "pageerror").map((e) => e.text);
  await page.close();
  // Must fully build: the panel opens, feature cards + toggles render, and the
  // dashboard stylesheet exists. When GM_addStyle is absent (strict VM) the
  // raw <style> fallback must carry the CSS.
  const built = result.opened && result.cards > 20 && result.toggles > 20 && !!result.dashCss;
  const styleFallbackOk = !result.addStyleMissing ? result.dashCss : result.dashCssIsStyle;
  const ok = built && styleFallbackOk && !result.threw;
  return Object.assign({ name, ok }, result, { errors: errors.slice(0, 5) });
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
    ["seekbar-marks", () => scenarioSeekbarMarks(browser)],
    ["aio-bundles", () => scenarioAioBundles(browser)],
    ["style-wipe", () => scenarioStyleWipe(browser)],
    ["dashboard-main", () => scenarioDashboard(browser, false)],
    ["dashboard-content", () => scenarioDashboard(browser, true)],
    // Strict Violentmonkey: content world, no GM_addStyle, no GM.* bridge —
    // the historical "undefined is not a function" environment.
    ["dashboard-content-strictvm", () => scenarioDashboard(browser, true, { addStyle: true, gmBridge: true })],
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
