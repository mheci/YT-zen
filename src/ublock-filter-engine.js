

  //  uBlock Filter Interpreter Engine
  const UBlockEngine = (() => {
    "use strict";

    const parseFilter = (line) => {
      const raw = line.trim();

      if (!raw || raw[0] === '!') return null;

      const hashIdx = raw.indexOf('##');
      if (hashIdx < 0) return null;

      const domain = raw.slice(0, hashIdx).trim();
      let selector = raw.slice(hashIdx + 2).trim();
      if (!selector) return null;

      const domains = [];
      const excludedDomains = [];
      if (domain) {
        for (let d of domain.split(',')) {
          d = d.trim().toLowerCase();
          if (!d) continue;

          let negated = false;
          if (d[0] === '~') { negated = true; d = d.slice(1); }

          if (!d || d.length < 4 || d.indexOf('.') < 0 || /[/:#\s]/.test(d)) continue;
          if (negated) excludedDomains.push(d);
          else domains.push(d);
        }
      }

      const hasHasText = /:has-text\(/.test(selector);
      const hasMatchesPath = /:matches-path\(/.test(selector);
      let isProcedural = hasHasText || hasMatchesPath;

      let pathRegex = null;
      if (hasMatchesPath) {
        const pathMatch = selector.match(/:matches-path\((\/.+?\/[gimsuy]*)\)/);
        if (pathMatch) {
          try {
            const parts = pathMatch[1].match(/^\/(.+)\/([gimsuy]*)$/);

            if (parts && parts[1].length <= MAX_REGEX_SOURCE) {

            pathRegex = new RegExp(parts[1], parts[2].replace(/[gy]/g, ""));
          }
          } catch (_) {}
        }
        if (!pathRegex) {

        return null;
      }
      selector = selector.replace(/:matches-path\((\/.+?\/[a-z]*|[^)]*)\)/i, "").trim();
      if (!selector) selector = '*';
      }

      const hasTextPatterns = [];
      if (hasHasText) {
        const regex = /:has-text\((\/.+?\/[gimsuy]*|[^)]+)\)/g;
        let match;
        while ((match = regex.exec(selector)) !== null) {
          const inner = match[1].trim();
          if (inner[0] === '/' && inner.lastIndexOf('/') > 0) {

            const lastSlash = inner.lastIndexOf('/');
            const pattern = inner.slice(1, lastSlash);
            const flags = inner.slice(lastSlash + 1);

            if (pattern.length <= MAX_REGEX_SOURCE) {
              try { hasTextPatterns.push(new RegExp(pattern, flags.replace(/[gy]/g, ""))); } catch (_) {}
            }
          } else {

            if (inner.length <= MAX_REGEX_SOURCE) {
              try { hasTextPatterns.push(new RegExp(escapeRegex(inner), 'i')); } catch (_) {}
            }
          }
        }

        const stripped = [];
        let last = 0;
        regex.lastIndex = 0;
        while ((match = regex.exec(selector)) !== null) {
          stripped.push(selector.slice(last, match.index));
          last = match.index + match[0].length;
        }
        stripped.push(selector.slice(last));
        selector = stripped.join('').trim();
        if (!selector) selector = '*';
      }

      let hasChildSelector = null;
      if (!supportsHas && selector.indexOf(":has(") >= 0) {
        const hasMatch = /:has\(([^)]+)\)/.exec(selector);
        if (hasMatch && hasMatch[1].trim()) {
          hasChildSelector = hasMatch[1].trim();
          selector = selector.replace(/:has\([^)]+\)/, "").trim() || "*";
          isProcedural = true;
        }
      }

      return {
        raw,
        domains,
        excludedDomains,
        selector,
        isProcedural,
        hasTextPatterns,
        pathRegex,
        hasChildSelector,
        isCssOnly: !isProcedural,
      };
    };

    const hostMatches = (list) => {
      const host = (location.hostname || '').toLowerCase();
      return list.some((d) => host === d || host.endsWith('.' + d));
    };

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const MAX_REGEX_SOURCE = 300;
    const MAX_TEXT_SCAN = 4000;
    const MAX_CANDIDATES = 5000;

    const isValidCssSelector = (sel) => {
      if (typeof sel !== "string" || !sel || sel.length > 500) return false;
      if (/[{};]/.test(sel)) return false;
      try { document.querySelector(sel); return true; } catch (_) {}
      try { document.querySelector(":scope " + sel); return true; } catch (_) { return false; }
    };

    const supportsHas = (() => {
      try { document.querySelector(":has(*)"); return true; } catch (_) { return false; }
    })();

    const parseFilterList = (text) => {
      const cssFilters = [];
      const procFilters = [];
      const pathFilters = [];

      if (!text) return { cssFilters, procFilters, pathFilters };

      const lines = text.split(/[\n\r]+/);
      for (const line of lines) {
        const filter = parseFilter(line);
        if (!filter) continue;

        if (filter.pathRegex) {
          pathFilters.push(filter);

          if (filter.hasTextPatterns.length > 0) {
            procFilters.push(filter);
          } else if (filter.selector && filter.selector !== '*') {
            cssFilters.push(filter);
          }
        } else if (filter.isProcedural) {
          procFilters.push(filter);
        } else {
          cssFilters.push(filter);
        }
      }

      return { cssFilters, procFilters, pathFilters };
    };

    const generateCSS = (cssFilters, activePath) => {
      const rules = [];
      for (const f of cssFilters) {

        if (f.domains.length > 0 && !hostMatches(f.domains)) continue;
        if (f.excludedDomains.length > 0 && hostMatches(f.excludedDomains)) continue;

        if (f.pathRegex) {
          const path = location.pathname || '/';
          if (!f.pathRegex.test(path)) continue;
        }

        if (!f.selector || f.selector === '*') continue;

        if (!isValidCssSelector(f.selector)) continue;
        rules.push(f.selector + '{display:none!important;visibility:hidden!important;pointer-events:none!important}');
      }
      return rules.join('\n');
    };

    const applyProcedural = (procFilters, pathFilters) => {
      const path = location.pathname || '/';
      let hidden = 0;

      for (const f of procFilters) {

        if (f.domains.length > 0 && !hostMatches(f.domains)) continue;
        if (f.excludedDomains.length > 0 && hostMatches(f.excludedDomains)) continue;

        if (f.pathRegex && !f.pathRegex.test(path)) continue;

        if (!f.selector || f.selector === '*') continue;

        let candidates;
        try { candidates = document.querySelectorAll(f.selector); } catch (_) { continue; }
        if (!candidates.length) continue;

        const cap = Math.min(candidates.length, MAX_CANDIDATES);

        if (f.hasTextPatterns.length > 0) {
          for (let ci = 0; ci < cap; ci++) {
            const el = candidates[ci];

            const text = (el.textContent || '').slice(0, MAX_TEXT_SCAN).trim();
            const matchesAll = f.hasTextPatterns.every(re => re.test(text));
            if (matchesAll) {
              if (!el.classList.contains('ytp-ublock-hidden')) {
                el.classList.add('ytp-ublock-hidden');
                hidden++;
              }
            }
          }
        }

        if (f.hasChildSelector) {
          for (let ci = 0; ci < cap; ci++) {
            const el = candidates[ci];
            let hit = false;
            try { hit = !!el.querySelector(f.hasChildSelector); } catch (_) { hit = false; }
            if (hit && !el.classList.contains('ytp-ublock-hidden')) {
              el.classList.add('ytp-ublock-hidden');
              hidden++;
            }
          }
        }
      }

      for (const f of pathFilters) {
        if (!f.pathRegex || !f.pathRegex.test(path)) continue;
        if (f.domains.length > 0 && !hostMatches(f.domains)) continue;
        if (f.excludedDomains.length > 0 && hostMatches(f.excludedDomains)) continue;
        if (f.selector && f.selector !== '*' && !f.hasTextPatterns.length) {
          try {
            const els = document.querySelectorAll(f.selector);
            const pCap = Math.min(els.length, MAX_CANDIDATES);
            for (let ci = 0; ci < pCap; ci++) {
              const el = els[ci];
              if (!el.classList.contains('ytp-ublock-hidden')) {
                el.classList.add('ytp-ublock-hidden');
                hidden++;
              }
            }
          } catch (_) {}
        }
      }

      return hidden;
    };

    const unhideAll = () => {
      document.querySelectorAll('.ytp-ublock-hidden').forEach(el => {
        el.classList.remove('ytp-ublock-hidden');
      });
    };

    return { parseFilter, parseFilterList, generateCSS, applyProcedural, unhideAll, escapeRegex };
  })();
