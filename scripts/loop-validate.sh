#!/usr/bin/env bash
# Full validation used every self-improvement round.
cd "$(dirname "$0")/.."
cp yt-zen.user.js /tmp/_pre.user.js 2>/dev/null
R=""
out() { R="$R$1\n"; }
node scripts/harness-boot.js >/dev/null 2>&1 && out "PASS boot-smoke" || out "FAIL boot-smoke"
npm run build >/dev/null 2>&1 && out "PASS build" || out "FAIL build"
if diff -q /tmp/_pre.user.js yt-zen.user.js >/dev/null; then out "PASS build-idempotent"; else out "FAIL build-idempotent"; fi
npm run check >/dev/null 2>&1 && out "PASS check" || out "FAIL check"
npm run test:unit >/dev/null 2>&1 && out "PASS unit" || out "FAIL unit"
npm run test:zen >/dev/null 2>&1 && out "PASS zen" || out "FAIL zen"
# node --check on the whole bundle body (fast syntax gate)
awk 'BEGIN{f=0} /==\/UserScript==/{f=1; print; next} f' yt-zen.user.js | tr -d '\r' > /tmp/_syntax.js
node --check /tmp/_syntax.js >/dev/null 2>&1 && out "PASS syntax" || out "FAIL syntax"
echo -e "$R" | sed '/^$/d'
