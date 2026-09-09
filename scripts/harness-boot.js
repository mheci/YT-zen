#!/usr/bin/env node
/*
 * Boot smoke harness: run the userscript IIFE inside jsdom against a minimal
 * YouTube-like DOM shell and report whether it boots without uncaught errors.
 * Used by the self-improvement loop to prove each round doesn't break boot.
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

const dom = new JSDOM(html, { url: "https://www.youtube.com/watch?v=test1234567", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
const g = window;

// --- GM shims (bare identifiers resolve via window in eval scope) ---
const mem = new Map();
g.GM_setValue = (k,v)=>mem.set(String(k), v);
g.GM_getValue = (k,d)=>mem.has(String(k))?mem.get(String(k)):(typeof d!=="undefined"?d:null);
g.GM_deleteValue=(k)=>mem.delete(String(k));
g.GM_listValues=()=>Array.from(mem.keys());
g.GM_registerMenuCommand=()=>{};
g.GM_xmlhttpRequest=(o)=>{ const t=setTimeout(()=>{ try{o&&o.onerror&&o.onerror({error:"no-network"});}catch(_){} },5); return {abort:()=>clearTimeout(t)}; };
g.GM_addStyle=(css)=>{ const st=g.document.createElement("style"); st.textContent=css; g.document.head.appendChild(st); return st; };
g.GM_info={ script:{ version:"3.16.2", name:"YT-zen" } };
g.unsafeWindow = g;
g.__YTPLUS_LOADED__ = undefined; // fresh

// --- API stubs ---
if (!g.requestIdleCallback) { g.requestIdleCallback=(fn)=>({ cancel:0 }, setTimeout(()=>fn({didTimeout:false}),0)); }
if (!g.cancelIdleCallback) g.cancelIdleCallback=()=>{};
g.requestAnimationFrame = g.requestAnimationFrame || ((cb)=>setTimeout(()=>cb(performance.now()),16));
g.cancelAnimationFrame = g.cancelAnimationFrame || ((id)=>clearTimeout(id));
if (!g.IntersectionObserver) g.IntersectionObserver=class { constructor(cb){this.cb=cb} observe(){} unobserve(){} disconnect(){} };
if (!g.ResizeObserver) g.ResizeObserver=class { observe(){} unobserve(){} disconnect(){} };
if (!g.MutationObserver) g.MutationObserver=window.MutationObserver;
if (!g.BroadcastChannel) g.BroadcastChannel=class { constructor(){this.onmessage=null} postMessage(){} close(){} };
g.fetch = (input, init)=>Promise.reject(new Error("fetch stubbed"));
g.Response = (typeof Response!=="undefined")?Response:null;
g.Headers = (typeof Headers!=="undefined")?Headers:null;
if (!g.performance) g.performance = performance;
g.crypto = require("crypto").webcrypto;
g.navigator.sendBeacon = ()=>false;
g.console = console;

const errors = [];
g.addEventListener("error", (e)=>{ errors.push(String(e.error && (e.error.message||e.error) || e.message)); });
g.addEventListener("unhandledrejection", (e)=>{ errors.push("rejection:"+String(e.reason && (e.reason.message||e.reason)||e.reason)); });
window.onerror = (m)=>errors.push(String(m));

const t0 = Date.now();
try {
  g.eval(body);
} catch (e) {
  console.error("TOP-LEVEL EVAL THROW:", e && e.stack);
  errors.push("eval-throw:" + (e && e.message));
}

// Boot is async; wait a bounded window then report.
const wait = (ms)=>new Promise(r=>setTimeout(r,ms));
(async () => {
  await wait(1200);           // allow shell check + applyAll microtasks/timers
  const applied = g.__zen_last_apply ? g.__zen_last_apply : "n/a";
  // mark apply done on window for harness instrumentation
  const elapsed = Date.now()-t0;
  const ok = errors.length === 0;
  console.log(JSON.stringify({ ok, errors: errors.slice(0,20), elapsed_ms: elapsed, applied }));
  process.exit(ok?0:2);
})();
