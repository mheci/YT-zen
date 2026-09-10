/*
 * Shared real-browser harness library (puppeteer-core + system Chromium).
 *
 * Injects the actual shipped yt-zen.user.js at document-start into real
 * YouTube pages, emulating two managers:
 *   - "main":     page-world injection (Tampermonkey classic / auto)
 *   - "content":  isolated world (Violentmonkey @inject-into content)
 *
 * This is test tooling, not shipped code.
 */
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.resolve(__dirname, "..");
const CHROMIUM = process.env.CHROMIUM_BIN || "/usr/bin/chromium";

function bundleBody() {
  const raw = fs.readFileSync(path.join(ROOT, "yt-zen.user.js"), "utf8");
  const body = raw.slice(raw.indexOf("(() => {"));
  if (!body.startsWith("(() => {")) throw new Error("userscript IIFE not found");
  return body;
}

function shimSource({ seed = {}, vmContent = false, drop = {} } = {}) {
  // The shim runs before the bundle. Bare GM_* identifiers resolve against
  // the global object in the page world; in the isolated world they resolve
  // as top-level lexical bindings we declare with var.
  // `drop` simulates manager builds with APIs absent (e.g. older Violentmonkey
  // did not always provide GM_addStyle under @inject-into content).
  return `
(function () {
  "use strict";
  var __drop = ${JSON.stringify(drop)};
  var __seed = ${JSON.stringify(JSON.stringify(seed))};
  var __store;
  try {
    __store = JSON.parse(${JSON.stringify(JSON.stringify(seed))});
  } catch (_) { __store = {}; }
  var __persist = function () {
    try { localStorage.setItem("__ytzen_gm_dump__", JSON.stringify(__store)); } catch (_) {}
  };
  var __gmGetValue = function (k, d) {
    try { return Object.prototype.hasOwnProperty.call(__store, String(k)) ? __store[String(k)] : d; }
    catch (_) { return d; }
  };
  var __gmSetValue = function (k, v) { try { __store[String(k)] = v; __persist(); } catch (_) {} };
  var __gmDeleteValue = function (k) { try { delete __store[String(k)]; __persist(); } catch (_) {} };
  var __gmListValues = function () { return Object.keys(__store); };
  var __gmAddStyle = function (css) {
    try {
      var st = document.createElement("style");
      st.id = "gm-added-style-" + Math.random().toString(36).slice(2);
      st.textContent = css;
      (document.head || document.documentElement).appendChild(st);
      return st;
    } catch (_) { return null; }
  };
  var __gmXhr = function (o) {
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var done = false;
    var handle = { abort: function () { try { done = true; ctrl && ctrl.abort(); } catch (_) {} } };
    try {
      // Privileged GM_xmlhttpRequest bypasses CORS. Emulate that: cross-origin
      // requests must use credentials:"omit" (servers like sponsor.ajay.app
      // return ACAO "*", which forbids credentialed fetches); same-origin
      // keeps cookies.
      var sameOrigin = false;
      try { sameOrigin = new URL(o.url, location.href).origin === location.origin; } catch (_) {}
      var credMode = sameOrigin && !o.anonymous ? "include" : "omit";
      fetch(o.url, {
        method: o.method || "GET",
        headers: o.headers || {},
        body: (o.data !== undefined && o.data !== null) ? o.data : undefined,
        credentials: credMode,
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function (r) {
        return r.text().then(function (txt) {
          if (done) return; done = true;
          try {
            var parsed = null; try { parsed = JSON.parse(txt); } catch (_) {}
            o.onload && o.onload({ status: r.status, responseText: txt, response: parsed,
              responseURL: r.url, readyState: 4, responseHeaders: "" });
          } catch (_) {}
        });
      }).catch(function (err) {
        if (done) return; done = true;
        try { o.onerror && o.onerror({ error: String(err && err.message || err) }); } catch (_) {}
      });
      if (o.timeout) setTimeout(function () { if (!done) { done = true; try { o.ontimeout && o.ontimeout(); } catch (_) {} handle.abort(); } }, o.timeout);
    } catch (err) { try { o.onerror && o.onerror({ error: String(err) }); } catch (_) {} }
    return handle;
  };
  window.__zenMenu = window.__zenMenu || {};
  var __register = function (label, fn) { window.__zenMenu[label] = fn; };
  var __gmInfo = { script: { name: "YT-zen", version: "3.17.2-test" }, injectInto: ${JSON.stringify(vmContent ? "content" : "page")}, version: "1.0" };

  // Always expose the page-bound menu entry the bundle uses as its VM fallback.
  Object.defineProperty(window, "__YTZEN_TEST_MODE__", { value: ${JSON.stringify(vmContent ? "content" : "main")} });

  // Classic GM_* globals are provided by BOTH Tampermonkey and Violentmonkey
  // (even in @inject-into content mode); in the isolated world these land on
  // the isolated global proxy and stay invisible to page scripts.
  if (!__drop.setValue) window.GM_setValue = __gmSetValue;
  if (!__drop.getValue) window.GM_getValue = __gmGetValue;
  if (!__drop.deleteValue) window.GM_deleteValue = __gmDeleteValue;
  if (!__drop.listValues) window.GM_listValues = __gmListValues;
  if (!__drop.addStyle) window.GM_addStyle = __gmAddStyle;
  if (!__drop.xhr) window.GM_xmlhttpRequest = __gmXhr;
  if (!__drop.menu) window.GM_registerMenuCommand = __register;
  window.GM_info = __gmInfo;
  window.unsafeWindow = window;
  if (${vmContent} && !__drop.gmBridge) {
    // Violentmonkey also exposes the GM.* promise bridge. Emulate its quirk:
    // async getValue/setValue and xmlHttpRequest camelCase.
    var __gm = {
      setValue: async function (k, v) { return __gmSetValue(k, v); },
      getValue: async function (k, d) { return __gmGetValue(k, d); },
      deleteValue: async function (k) { return __gmDeleteValue(k); },
      listValues: async function () { return __gmListValues(); },
      xmlHttpRequest: __gmXhr,
      registerMenuCommand: __register,
      addStyle: __drop.addStyle ? undefined : async function (css) { return __gmAddStyle(css); },
      info: __gmInfo,
    };
    Object.defineProperty(window, "GM", { value: __gm });
  }
})();
`;
}

async function launch(browserLog) {
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--mute-audio",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  return browser;
}

// The userscript header declares @noframes: real managers inject only the
// top frame. CDP addScriptToEvaluateOnNewDocument instead runs in EVERY
// frame (including same-origin about:blank children), where duplicate
// engines race the cross-tab config sync and revert each other's settings.
// Wrap every injected source in a top-frame guard to match @noframes.
const topFrameOnly = (src) => `if (window.top === window.self) {\n${src}\n}\n`;

// Inject shim + requires + bundle into a page at document-start.
async function inject(page, { seed = {}, vmContent = false, drop = {} } = {}) {
  const lz = fs.readFileSync(path.join(ROOT, "scripts/fixtures/lz-string.min.js"), "utf8");
  const culori = fs.readFileSync(path.join(ROOT, "scripts/fixtures/culori.min.js"), "utf8");
  const body = bundleBody();
  if (!vmContent) {
    await page.evaluateOnNewDocument(topFrameOnly(shimSource({ seed, vmContent: false, drop })));
    await page.evaluateOnNewDocument(topFrameOnly(lz));
    await page.evaluateOnNewDocument(topFrameOnly(culori));
    await page.evaluateOnNewDocument(topFrameOnly(body));
    return null;
  }
  // CDP isolated world — emulate @inject-into content precisely.
  const cdp = await page.createCDPSession();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  const contexts = new Map();
  cdp.on("Runtime.executionContextCreated", ({ context }) => {
    contexts.set(context.id, context);
  });
  cdp.on("Runtime.executionContextDestroyed", ({ executionContextId }) => {
    contexts.delete(executionContextId);
  });
  cdp.on("Runtime.executionContextsCleared", () => contexts.clear());
  for (const src of [shimSource({ seed, vmContent: true, drop }), lz, culori, body]) {
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: topFrameOnly(src), worldName: "ytzen-content" });
  }
  page.__zenCdp = cdp;
  // Detach the CDP session before the target closes; otherwise a raced
  // teardown can surface as "Session with given id not found" on a later
  // createTarget (observed running multiple content scenarios in one run).
  const _origClose = page.close.bind(page);
  page.close = async () => {
    try { await cdp.detach(); } catch (_) {}
    return _origClose();
  };
  page.evalContent = async function (expression) {
    let contextId;
    for (let i = 0; i < 50 && contextId === undefined; i++) {
      for (const c of contexts.values()) {
        if (c.name === "ytzen-content" || (c.auxData && c.auxData.isDefault === false && /ytzen/i.test(c.name || ""))) {
          contextId = c.id;
          break;
        }
      }
      if (contextId === undefined) await new Promise((r) => setTimeout(r, 100));
    }
    const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
      expression: `(function(){ try { return (${expression}); } catch (e) { return "__EVAL_ERROR__:" + (e && e.message); } })()`,
      contextId,
      returnByValue: true,
      awaitPromise: true,
    });
    if (exceptionDetails) return "__EVAL_ERROR__:" + (exceptionDetails.exception && exceptionDetails.exception.description || "eval failed");
    return result ? result.value : undefined;
  };
  return cdp;
}

function attachConsole(page, log, { trace = false } = {}) {
  const entries = [];
  page.on("console", (msg) => {
    const text = msg.text();
    entries.push({ type: msg.type(), text });
    if (trace && /YT-zen|YTPlus|zen/i.test(text)) log("[console." + msg.type() + "] " + text);
  });
  page.on("pageerror", (err) => {
    entries.push({ type: "pageerror", text: String(err && err.message || err) });
  });
  return entries;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { launch, inject, attachConsole, wait, bundleBody, ROOT };
