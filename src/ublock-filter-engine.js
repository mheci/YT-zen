  // ═══════════════════════════════════════════════════════════════════════════
  //  uBlock Filter Interpreter Engine
  // ---------------------------------------------------------------------------
  //  Parses and executes uBlock Origin cosmetic filters for channel blocking.
  //
  //  Supported syntax:
  //    domain##selector          - Element hiding (domain-scoped)
  //    ##selector                - Global element hiding
  //    :has(selector)            - Procedural: ancestor matching descendant
  //    :has-text(/regex/flags)   - Procedural: text content matching regex
  //    :has-text(string)         - Procedural: text content containing string
  //    :matches-path(/regex/)    - Procedural: URL path matching regex
  //    :is(sel1, sel2, ...)      - CSS :is() pseudo-class (native)
  //    [attr^="val" i]           - Case-insensitive attribute selectors
  //    ! comment                 - Comment lines (ignored)
  //    # comment                 - Comment lines (ignored)
  //
  //  Backward compatible: plain channel names and @handles still work.
  // ═══════════════════════════════════════════════════════════════════════════

  const UBlockEngine = (() => {
    "use strict";

    // ─── Filter Parser ───────────────────────────────────────────────────────
    // Parses a single filter line into a structured object.
    // Returns null for comments, blank lines, or unparseable lines.
    const parseFilter = (line) => {
      const raw = line.trim();
      if (!raw || raw[0] === '!' || raw[0] === '#') return null;

      // Check for cosmetic filter: domain##selector or ##selector
      const hashIdx = raw.indexOf('##');
      if (hashIdx < 0) return null;

      const domain = raw.slice(0, hashIdx).trim();
      let selector = raw.slice(hashIdx + 2).trim();
      if (!selector) return null;

      // Check domain scope
      const domains = [];
      const excludedDomains = [];
      if (domain) {
        for (let d of domain.split(',')) {
          d = d.trim().toLowerCase();
          if (!d) continue;
          // uBlock "~domain" negation: excluded hosts, never include-matched.
          if (d[0] === '~') { if (d.length > 1) excludedDomains.push(d.slice(1)); }
          else domains.push(d);
        }
      }
      const hostMatches = (list) => {
        const host = (location.hostname || '').toLowerCase();
        return list.some((d) => host === d || host.endsWith('.' + d));
      };

      // Detect procedural filters
      const hasHasText = /:has-text\(/.test(selector);
      const hasMatchesPath = /:matches-path\(/.test(selector);
      const isProcedural = hasHasText || hasMatchesPath;

      // Extract :matches-path() regex
      let pathRegex = null;
      if (hasMatchesPath) {
        const pathMatch = selector.match(/:matches-path\((\/.+?\/[gimsuy]*)\)/);
        if (pathMatch) {
          try {
            const parts = pathMatch[1].match(/^\/(.+)\/([gimsuy]*)$/);
            if (parts) {
            // test() is reused across navigations; stateful g/y flags make
            // matching alternate true/false.
            pathRegex = new RegExp(parts[1], parts[2].replace(/[gy]/g, ""));
          }
          } catch (_) {}
        }
        if (!pathRegex) {
        // Unparseable :matches-path token: stripping it would turn a scoped
        // filter into an every-page hide; reject the line instead.
        return null;
      }
      selector = selector.replace(/:matches-path\((\/.+?\/[a-z]*|[^)]*)\)/i, "").trim();
      if (!selector) selector = '*';
      }

      // Extract :has-text() patterns
      const hasTextPatterns = [];
      if (hasHasText) {
        const regex = /:has-text\((\/.+?\/[gimsuy]*|[^)]+)\)/g;
        let match;
        while ((match = regex.exec(selector)) !== null) {
          const inner = match[1].trim();
          if (inner[0] === '/' && inner.lastIndexOf('/') > 0) {
            // Regex pattern: /pattern/flags
            const lastSlash = inner.lastIndexOf('/');
            const pattern = inner.slice(1, lastSlash);
            const flags = inner.slice(lastSlash + 1);
            try { hasTextPatterns.push(new RegExp(pattern, flags.replace(/[gy]/g, ""))); } catch (_) {}
          } else {
            // Plain string: convert to case-insensitive regex
            try { hasTextPatterns.push(new RegExp(escapeRegex(inner), 'i')); } catch (_) {}
          }
        }
        // Strip :has-text(...) using the exec match ranges: a [^)]* stripper
        // corrupts patterns containing ')'.
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

      return {
        raw,
        domains,
        excludedDomains,
        selector,
        isProcedural,
        hasTextPatterns,
        pathRegex,
        isCssOnly: !isProcedural,
      };
    };

    // Escape special regex characters in a string
    const hostMatches = (list) => {
      const host = (location.hostname || '').toLowerCase();
      return list.some((d) => host === d || host.endsWith('.' + d));
    };

    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ─── Filter List Parser ──────────────────────────────────────────────────
    // Parses the full blocklist text into categorized filter arrays.
    const parseFilterList = (text) => {
      const cssFilters = [];     // Pure CSS filters (injected as stylesheet)
      const procFilters = [];    // Procedural filters (need JS DOM scanning)
      const pathFilters = [];    // Path-based filters (checked on navigation)

      if (!text) return { cssFilters, procFilters, pathFilters };

      const lines = text.split(/[\n\r]+/);
      for (const line of lines) {
        const filter = parseFilter(line);
        if (!filter) continue;

        if (filter.pathRegex) {
          pathFilters.push(filter);
          // Path filters may also have CSS/procedural parts
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

    // ─── CSS Generator ───────────────────────────────────────────────────────
    // Converts CSS-only filters into a single stylesheet string.
    const generateCSS = (cssFilters, activePath) => {
      const rules = [];
      for (const f of cssFilters) {
        // Check domain scope
        if (f.domains.length > 0 && !hostMatches(f.domains)) continue;
        if (f.excludedDomains.length > 0 && hostMatches(f.excludedDomains)) continue;

        // Check path regex for path-scoped CSS filters
        if (f.pathRegex) {
          const path = location.pathname || '/';
          if (!f.pathRegex.test(path)) continue;
        }

        if (f.selector) {
          rules.push(f.selector + '{display:none!important;visibility:hidden!important;pointer-events:none!important}');
        }
      }
      return rules.join('\n');
    };

    // ─── Procedural Filter Executor ──────────────────────────────────────────
    // Scans the DOM and applies procedural filters (:has-text, :matches-path).
    const applyProcedural = (procFilters, pathFilters) => {
      const path = location.pathname || '/';
      let hidden = 0;

      for (const f of procFilters) {
        // Check domain scope
        if (f.domains.length > 0 && !hostMatches(f.domains)) continue;
        if (f.excludedDomains.length > 0 && hostMatches(f.excludedDomains)) continue;

        // Check path regex
        if (f.pathRegex && !f.pathRegex.test(path)) continue;

        // Whole-page procedural filters ('*' selector) would serialize the textContent
        // of every node; page-wide blocking is handled by the path-class mechanism.
        if (!f.selector || f.selector === '*') continue;

        // Find candidate elements
        let candidates;
        try { candidates = document.querySelectorAll(f.selector); } catch (_) { continue; }
        if (!candidates.length) continue;

        // Apply :has-text() filter
        if (f.hasTextPatterns.length > 0) {
          for (const el of candidates) {
            const text = (el.textContent || '').trim();
            const matchesAll = f.hasTextPatterns.every(re => re.test(text));
            if (matchesAll) {
              if (!el.classList.contains('ytp-ublock-hidden')) {
                el.classList.add('ytp-ublock-hidden');
                hidden++;
              }
            }
          }
        }
      }

      // Apply path-based hiding
      for (const f of pathFilters) {
        if (!f.pathRegex || !f.pathRegex.test(path)) continue;
        if (f.domains.length > 0 && !hostMatches(f.domains)) continue;
        if (f.excludedDomains.length > 0 && hostMatches(f.excludedDomains)) continue;
        if (f.selector && f.selector !== '*' && !f.hasTextPatterns.length) {
          try {
            const els = document.querySelectorAll(f.selector);
            for (const el of els) {
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

    // ─── Unhide ──────────────────────────────────────────────────────────────
    // Removes all ublock-hidden classes (called when feature is disabled).
    const unhideAll = () => {
      document.querySelectorAll('.ytp-ublock-hidden').forEach(el => {
        el.classList.remove('ytp-ublock-hidden');
      });
    };

    return { parseFilter, parseFilterList, generateCSS, applyProcedural, unhideAll, escapeRegex };
  })();
