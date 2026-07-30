#!/usr/bin/env node
"use strict";

const crypto = require("crypto");

const videoId = process.argv[2] || "JQb9eGeclQw";
if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
  console.error("Expected an 11-character YouTube video ID.");
  process.exit(2);
}

const base = "https://sponsor.ajay.app";
const categories = [
  "sponsor", "selfpromo", "interaction", "intro", "outro", "preview",
  "hook", "filler", "music_offtopic", "poi_highlight", "exclusive_access", "chapter",
];
const actionTypes = ["skip", "mute", "poi", "chapter", "full"];
const prefix = crypto.createHash("sha256").update(videoId).digest("hex").slice(0, 4);

function query({ direct = false, json = false } = {}) {
  const params = new URLSearchParams();
  if (direct) params.set("videoID", videoId);
  params.set("service", "YouTube");
  if (json) {
    params.set("categories", JSON.stringify(categories));
    params.set("actionTypes", JSON.stringify(actionTypes));
  } else {
    for (const category of categories) params.append("category", category);
    for (const actionType of actionTypes) params.append("actionType", actionType);
  }
  return params;
}

const plans = [
  {
    name: "direct-repeated",
    privacy: false,
    url: `${base}/api/skipSegments?${query({ direct: true }).toString()}`,
  },
  {
    name: "direct-json",
    privacy: false,
    url: `${base}/api/skipSegments?${query({ direct: true, json: true }).toString()}`,
  },
  {
    name: "privacy-path-json",
    privacy: true,
    url: `${base}/api/skipSegments/${prefix}?${query({ json: true }).toString()}`,
  },
  {
    name: "privacy-path-repeated",
    privacy: true,
    url: `${base}/api/skipSegments/${prefix}?${query().toString()}`,
  },
];

function normalize(payload, privacy) {
  if (!Array.isArray(payload)) return { matched: false, segments: [] };
  if (!privacy) return { matched: true, segments: payload };
  const hit = payload.find((entry) => entry && entry.videoID === videoId && Array.isArray(entry.segments));
  return { matched: !!hit, segments: hit ? hit.segments : [] };
}

(async () => {
  console.log(`Testing SponsorBlock lookup plans for ${videoId} (privacy prefix ${prefix})`);
  let failures = 0;
  let directSegments = null;
  for (const plan of plans) {
    try {
      const response = await fetch(plan.url, {
        headers: { "user-agent": "YT-zen-test-harness/3.8.0" },
      });
      const text = await response.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch (_) {}
      const result = normalize(payload, plan.privacy);
      const expectedStatus = response.status >= 200 && response.status < 300;
      const valid = expectedStatus && (!plan.privacy || result.matched || result.segments.length === 0);
      if (!valid) failures++;
      if (!plan.privacy && expectedStatus && directSegments === null) directSegments = result.segments.length;
      console.log(`\n[${plan.name}] status=${response.status} matched=${result.matched} segments=${result.segments.length}${valid ? "" : " FAIL"}`);
      for (const segment of result.segments.slice(0, 5)) {
        const range = Array.isArray(segment.segment) ? segment.segment : [segment.startTime, segment.endTime];
        console.log(`  - ${segment.category || "?"} ${segment.actionType || "skip"} ${range[0]} -> ${range[1]} ${segment.UUID || ""}`);
      }
      if (!result.segments.length && !expectedStatus) console.log(text.slice(0, 240));
    } catch (error) {
      failures++;
      console.log(`\n[${plan.name}] ERROR ${error && error.message ? error.message : error}`);
    }
  }
  if (failures) {
    console.error(`\n${failures} SponsorBlock plan(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${plans.length} lookup plans completed successfully${directSegments === null ? "" : ` (${directSegments} direct segments)`}.`);
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
