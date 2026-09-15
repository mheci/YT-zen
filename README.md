# YT-zen 🌿

**Your YouTube, your way — calmer, cleaner, and entirely yours.**

YT-zen is a userscript that gives YouTube a client-side makeover: a full settings
dashboard, 200 hand-tuned themes, SponsorBlock superpowers, feed filtering,
playback tools, and dozens of quality-of-life touches — all in one lightweight
install, with no accounts, no servers, and no telemetry.

---

## ✨ What you get

- **A real settings dashboard** — press the YT-zen menu entry (or the gear in the
  guide) and tune 120+ controls, from layout density to Shorts removal, with live
  search and instant apply.
- **200 built-in themes, light and dark** — every theme restyles the *entire*
  interface: background layers, text, chips, dialogs, the player chrome, **the
  YouTube logo and every toolbar icon**. Text and icon colors are
  contrast-checked on the fly, so nothing ever vanishes into the background —
  in light or dark mode.
- **One-color custom themes** — pick any accent and YT-zen derives a complete,
  balanced palette from it (powered by culori).
- **SponsorBlock, done respectfully** — automatic sponsor/intro/outro skips with
  privacy-first lookups: your video is never sent in the clear, only a hashed
  prefix.
- **Feed controls** — hide watched, filter titles/channels, calm the shelf chaos,
  tidy the home grid.
- **Playback & session tools** — resume cards, autoplay holds, keyboard
  shortcuts, and a command palette (`Ctrl+Shift+P` on the player).

## 🎨 Themes that behave

Most themes fight YouTube's own styles and lose — white logos on pastel
mastheads, ghost icons, unreadable chips. YT-zen's theme engine instead signs a
**complete contract** with every palette:

1. **Full-scope variables** — backgrounds, text, icons, outlines, dialogs,
   chips, live chat, guide, search box, and the masthead are all covered, with
   per-component scoping that survives YouTube's own dark/light rules.
2. **Logo & icon coverage** — explicit rules recolor the wordmark, the Premium
   superscript, the hamburger, search, voice, create, and bell controls in both
   modes; the play-button keeps its brand red.
3. **Adaptive contrast** — before a theme ships to your screen, its text and
   icon inks are automatically deepened (light themes) or lifted (dark themes)
   until they clear WCAG-AA contrast against the background. Even custom
   one-color themes get this for free.

Switch themes from **Settings → Appearance**, or let the Night Scheduler flip
between a dark and a light palette on your clock.

## 📦 Install

1. Grab [Tampermonkey](https://www.tampermonkey.net/) or
   [Violentmonkey](https://violentmonkey.github.io/) on Firefox or any
   Chromium browser.
2. Open the latest release on this repository and click
   **`yt-zen.user.js`** — your manager will offer to install it.
3. Visit YouTube. The YT-zen entry appears in the guide menu. That's it.

Updates arrive through the release channel; keep auto-updates on.

## 🛡️ Privacy & safety posture

- Everything runs **client-side**. Nothing phones home.
- SponsorBlock queries are **hashed-prefix only**; lookups fail closed if a
  secure hash isn't available.
- Features that impersonate watch activity (Force-Watched, account/local
  history companions, Algorithm Intelligence) are **off by default** and ask
  for an explicit acknowledgement — they interact with your YouTube account,
  so enable them deliberately.

## 🧑‍💻 For developers

```bash
npm ci          # install toolchain
npm run build   # rebuild yt-zen.user.js from src/ mirrors
npm test        # deterministic gate: build + checks + audits + unit suites
```

The deterministic gate is also what CI runs on every push and tag; the
published userscript must be byte-identical to a rebuild from source.

## 📄 License

Unlicense — do anything you like with it. See `LICENSE`.

---

Made with care for calmer screens. 🌙☀️
