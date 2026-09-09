#!/usr/bin/env node
/* Repro: invoke every registered menu command (Violentmonkey prints handler
 * errors in its menu). Goal: catch "undefined is not a function" from the
 * dashboard open path with a full stack. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = "/home/user/ytzen";
const raw = fs.readFileSync(path.join(root, "yt-zen.user.js"), "utf8");
const body = raw.slice(raw.indexOf("(() => {"));

const html = `<!DOCTYPE html><html><head></head><body>
  <div id="page-manager"><ytd-app>
    <div id="contents"><ytd-rich-grid-renderer><div id="contents"></div></ytd-rich-grid-renderer></div>
  </ytd-app></div>
  <div id="movie_player"><video class="html5-main-video"></video></div>
</body></html>`;

const dom = new JSDOM(html, { url: "https://www.youtube.com/", runScripts: "outside-only", pretendToBeVisual: true });
const g = dom.window;
const mem = new Map();
const menuCommands = [];
g.GM_setValue = (k, v) => mem.set(String(k), v);
g.GM_getValue = (k, d) => (mem.has(String(k)) ? mem.get(String(k)) : typeof d !== "undefined" ? d : null);
g.GM_deleteValue = (k) => mem.delete(String(k));
g.GM_listValues = () => Array.from(mem.keys());
g.GM_registerMenuCommand = (label, fn) => menuCommands.push({ label: String(label), fn });
g.GM_xmlhttpRequest = (o) => { const t = setTimeout(() => { try { o && o.onerror && o.onerror({ error: "no-network" }); } catch (_) {} }, 5); return { abort: () => clearTimeout(t) }; };
g.GM_addStyle = (css) => { const st = g.document.createElement("style"); st.textContent = css; g.document.head.appendChild(st); return st; };
g.GM_info = { script: { version: "3.16.7", name: "YT-zen" } };
g.unsafeWindow = g;
if (!g.requestIdleCallback) g.requestIdleCallback = (fn) => setTimeout(() => fn({ didTimeout: false }), 0);
if (!g.cancelIdleCallback) g.cancelIdleCallback = () => {};
g.requestAnimationFrame = g.requestAnimationFrame || ((cb) => setTimeout(() => cb(performance.now()), 16));
g.cancelAnimationFrame = g.cancelAnimationFrame || ((id) => clearTimeout(id));
if (!g.IntersectionObserver) g.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!g.ResizeObserver) g.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!g.BroadcastChannel) g.BroadcastChannel = class { constructor() { this.onmessage = null; } postMessage() {} close() {} };
g.fetch = () => Promise.reject(new Error("fetch stubbed"));
g.crypto = require("crypto").webcrypto;
g.navigator.sendBeacon = () => false;
g.indexedDB = { open: () => ({ set onupgradeneeded(_) {}, set onsuccess(_) {}, set onerror(_) {}, set onblocked(_) {} }) };

try {
  g.eval(body);
} catch (e) {
  console.log("BOOT THROW:", e && (e.stack || e.message || e));
  process.exit(1);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  await wait(2500);
  console.log("registered commands:", menuCommands.map((c) => c.label).join(" | "));
  // invoke the dashboard command twice: second open must stay stable
  const dash = menuCommands.find((c) => c.label.includes("dashboard"));
  for (let i = 0; i < 2; i++) {
    try { dash.fn(); await wait(200); console.log("[dashboard open #" + (i + 1) + "] ok, wo open:", !!g.document.getElementById("ytp-dash") ); }
    catch (e) { console.log("[dashboard open #" + (i + 1) + "] THROW:", e && (e.stack || e.message)); }
  }
  for (const c of menuCommands.filter((c) => !c.label.includes("dashboard"))) {
    try {
      const r = c.fn();
      if (r && typeof r.then === "function") await r.catch((e) => console.log("[" + c.label + "] rejected:", e && (e.stack || e.message || e)));
      await wait(300);
      console.log("[" + c.label + "] ok");
    } catch (e) {
      console.log("[" + c.label + "] THROW:", e && (e.stack || e.message || e));
    }
  }
  process.exit(0);
})();
