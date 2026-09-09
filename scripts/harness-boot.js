#!/usr/bin/env node
/*
 * Boot smoke harness: run the userscript IIFE inside jsdom against a minimal
 * YouTube-like DOM shell and report whether it boots without uncaught errors.
 * Used by the self-improvement loop to prove each round doesn't break boot.
 *
 * Scenario A ("plain"): healthy stubs — boot must complete and apply.
 * Scenario B ("idb-hang"): indexedDB.open never settles — boot must STILL
 *   complete and apply within the bounded window (config load is raced; the
 *   IDB layer must never wedge first launch — the historical "works only
 *   after a hard refresh" bug).
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const raw = fs.readFileSync(path.join(root, "yt-zen.user.js"), "utf8");
// strip metadata header
const body = raw.slice(raw.indexOf("(() => {"));
if (!body.startsWith("(() => {")) { console.error("no IIFE found"); process.exit(1); }

const html = `<!DOCTYPE html><html><head></head><body>
  <div id="page-manager"><ytd-app>
    <div id="contents"><ytd-rich-grid-renderer><div id="contents"></div></ytd-rich-grid-renderer></div>
  </ytd-app></div>
  <div id="movie_player"><video class="html5-main-video"></video></div>
</body></html>`;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeDom({ hangIdb } = {}) {
  const dom = new JSDOM(html, { url: "https://www.youtube.com/watch?v=test1234567", runScripts: "outside-only", pretendToBeVisual: true });
  const g = dom.window;

  // --- GM shims (bare identifiers resolve via window in eval scope) ---
  const mem = new Map();
  g.GM_setValue = (k, v) => mem.set(String(k), v);
  g.GM_getValue = (k, d) => (mem.has(String(k)) ? mem.get(String(k)) : typeof d !== "undefined" ? d : null);
  g.GM_deleteValue = (k) => mem.delete(String(k));
  g.GM_listValues = () => Array.from(mem.keys());
  g.GM_registerMenuCommand = () => {};
  g.GM_xmlhttpRequest = (o) => { const t = setTimeout(() => { try { o && o.onerror && o.onerror({ error: "no-network" }); } catch (_) {} }, 5); return { abort: () => clearTimeout(t) }; };
  g.GM_addStyle = (css) => { const st = g.document.createElement("style"); st.textContent = css; g.document.head.appendChild(st); return st; };
  g.GM_info = { script: { version: "3.16.2", name: "YT-zen" } };
  g.unsafeWindow = g;

  // --- API stubs ---
  if (!g.requestIdleCallback) { g.requestIdleCallback = (fn) => setTimeout(() => fn({ didTimeout: false }), 0); }
  if (!g.cancelIdleCallback) g.cancelIdleCallback = () => {};
  g.requestAnimationFrame = g.requestAnimationFrame || ((cb) => setTimeout(() => cb(performance.now()), 16));
  g.cancelAnimationFrame = g.cancelAnimationFrame || ((id) => clearTimeout(id));
  if (!g.IntersectionObserver) g.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!g.ResizeObserver) g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!g.BroadcastChannel) g.BroadcastChannel = class { constructor() { this.onmessage = null; } postMessage() {} close() {} };
  g.fetch = () => Promise.reject(new Error("fetch stubbed"));
  g.crypto = require("crypto").webcrypto;
  g.navigator.sendBeacon = () => false;

  if (hangIdb) {
    // An open() that never fires any event: the exact shape of a blocked
    // version upgrade or a wedged store. The boot layer must time this out
    // instead of awaiting it forever.
    g.indexedDB = {
      open: () => ({ set onupgradeneeded(_) {}, set onsuccess(_) {}, set onerror(_) {}, set onblocked(_) {} }),
    };
  }

  const errors = [];
  g.addEventListener("error", (e) => { errors.push(String((e.error && (e.error.message || e.error)) || e.message)); });
  g.addEventListener("unhandledrejection", (e) => { errors.push("rejection:" + String((e.reason && (e.reason.message || e.reason)) || e.reason)); });
  g.onerror = (m) => errors.push(String(m));
  return { g, errors };
}

async function bootScenario(name, opts) {
  const { g, errors } = makeDom(opts);
  const t0 = Date.now();
  try {
    g.eval(body);
  } catch (e) {
    console.error(`[${name}] TOP-LEVEL EVAL THROW:`, e && e.stack);
    errors.push("eval-throw:" + (e && e.message));
  }
  let applied = false;
  // Boot applies after the shell wait; allow a generous but bounded window.
  for (let i = 0; i < 90 && !applied; i++) {
    await wait(100);
    applied = !!g.__zen_last_apply;
  }
  const elapsed = Date.now() - t0;
  const ok = errors.length === 0 && applied;
  const result = { scenario: name, ok, applied, elapsed_ms: elapsed, errors: errors.slice(0, 10) };
  console.log(JSON.stringify(result));
  return result;
}

(async () => {
  const a = await bootScenario("plain", {});
  const b = await bootScenario("idb-hang", { hangIdb: true });
  // The whole point of the IDB guards: a hung open must not cost more than
  // the race cap + shell wait + margin. If this regresses, first launch wedges.
  if (b.ok && b.elapsed_ms > 12000) {
    console.error("[idb-hang] applied but too slowly — boot was likely wedged on IDB");
    b.ok = false;
  }
  const ok = a.ok && b.ok;
  if (!ok) process.exit(2);
  // The userscript installs session-length intervals; the jsdom VM would
  // keep this process alive forever without an explicit exit.
  process.exit(0);
})();
