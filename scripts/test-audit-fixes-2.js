#!/usr/bin/env node


"use strict";
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const engineSrc = fs.readFileSync(path.join(root, "src", "ublock-filter-engine.js"), "utf8");

function makeContext({ supportsHas }) {
  const hidden = new Set();
  const makeEl = (id, opts = {}) => ({
    id,
    nodeType: 1,
    textContent: opts.text || "",
    children: opts.children || [],
    classList: {
      _set: hidden,
      contains(c) { return hidden.has(id + ":" + c); },
      add(c) { hidden.add(id + ":" + c); },
      remove(c) { hidden.delete(id + ":" + c); },
    },
    querySelector(sel) {
      if (sel === ".ad") return opts.hasAdChild ? { nodeType: 1 } : null;
      return null;
    },
    querySelectorAll() { return []; },
    matches() { return false; },
  });

  const cardWithAd = makeEl("card1", { hasAdChild: true });
  const cardClean = makeEl("card2", { text: "hello NEEDLE world" });

  const cardLong = makeEl("card3", { text: "x".repeat(20000) + "NEEDLE" });

  const document = {
    querySelector(sel) {
      if (sel === ":has(*)" && !supportsHas) throw new Error("':has' not supported");
      if (/[{};]/.test(sel)) throw new Error("invalid selector");
      if (sel === "bogus>>>") throw new Error("invalid selector");
      if (sel.indexOf(":has(") >= 0 && !supportsHas) throw new Error("':has' not supported");
      return null;
    },
    querySelectorAll(sel) {
      if (/[{};]/.test(sel)) throw new Error("invalid selector");
      if (sel === ".card") return [cardWithAd, cardClean, cardLong];
      return [];
    },
  };

  const context = vm.createContext({
    console,
    document,
    location: { hostname: "www.youtube.com", pathname: "/watch" },
    globalThis: {},
  });
  vm.runInContext(engineSrc + "\n;globalThis.UBlockEngine = UBlockEngine;\n", context, {
    filename: "src/ublock-filter-engine.js",
  });
  return { engine: context.globalThis.UBlockEngine, hidden, cardWithAd, cardClean, cardLong };
}

{
  const { engine, hidden, cardWithAd, cardClean } = makeContext({ supportsHas: false });

  const malicious = engine.parseFilterList("##x{}*{background:url(https://attacker/x)}");
  assert.strictEqual(engine.generateCSS(malicious.cssFilters), "", "UB-01: breakout selector rejected");

  const good = engine.parseFilterList("##.advert");
  assert.ok(engine.generateCSS(good.cssFilters).indexOf(".advert{display:none") === 0, "UB-01: valid selector emits");

  const mixed = engine.parseFilterList("##bad{sel\n##.good");
  const css = engine.generateCSS(mixed.cssFilters);
  assert.ok(css.indexOf(".good{display:none") >= 0, "UB-04: sibling rule survives");
  assert.ok(css.indexOf("bad{sel") < 0, "UB-04: invalid rule dropped");

  const big = engine.parseFilterList("##.card:has-text(/" + "a".repeat(400) + "/)");
  const procBig = big.procFilters[0];
  assert.ok(procBig, "filter parsed");
  assert.strictEqual(procBig.hasTextPatterns.length, 0, "UB-02: oversize pattern rejected");

  const txt = engine.parseFilterList("##.card:has-text(NEEDLE)");
  const before = Date.now();
  const hid = engine.applyProcedural(txt.procFilters, []);
  assert.ok(Date.now() - before < 500, "UB-02: bounded runtime");
  assert.ok(hid >= 1, "UB-02: in-cap text still matches");

  const has = engine.parseFilter("##.card:has(.ad)");
  assert.strictEqual(has.isProcedural, true, "UB-05: routed procedural without native :has");
  assert.strictEqual(has.hasChildSelector, ".ad");
  const hidHas = engine.applyProcedural([has], []);
  assert.ok(hidHas >= 1, "UB-05: fallback hides ancestor");
  assert.ok(hidden.has("card1:ytp-ublock-hidden"), "UB-05: correct element hidden");

  const pr = engine.parseFilter("##.card:matches-path(/watch/gy)");
  assert.ok(pr && pr.pathRegex, "path filter parsed");
  const r1 = pr.pathRegex.test("/watch");
  const r2 = pr.pathRegex.test("/watch");
  assert.strictEqual(r1, r2, "UB-06: stateful flags stripped (pin)");
  assert.strictEqual(r1, true);

  const degen = engine.parseFilter("com##.x");
  assert.strictEqual(degen.domains.length, 0, "UB-08: 'com' rejected");
  const nodot = engine.parseFilter("youtube##.x");
  assert.strictEqual(nodot.domains.length, 0, "UB-08: dotless entry rejected");
  const okdom = engine.parseFilter("youtube.com##.x");
  assert.strictEqual(JSON.stringify(okdom.domains), '["youtube.com"]', "UB-08: normal domain kept");
  const slashy = engine.parseFilter("youtube.com/evil##.x");
  assert.strictEqual(slashy.domains.length, 0, "UB-08: path-smuggling entry rejected");

  engine.unhideAll();
}

{
  const { engine } = makeContext({ supportsHas: true });
  const has = engine.parseFilter("##.card:has(.ad)");
  assert.strictEqual(has.hasChildSelector, null, "UB-05: native path leaves selector in CSS");
  assert.strictEqual(has.isProcedural, false);
  const css = engine.generateCSS([has]);
  assert.ok(css.indexOf(":has(.ad)") >= 0, "UB-05: native :has emitted as CSS");
}

console.log("Audit-fix tests (batch 2: UB) passed.");
