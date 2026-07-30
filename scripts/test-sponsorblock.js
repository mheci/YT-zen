#!/usr/bin/env node
const crypto = require('crypto');

const videoId = process.argv[2] || 'JQb9eGeclQw';
const base = 'https://sponsor.ajay.app';
const categories = ['sponsor','selfpromo','interaction','intro','outro','preview','hook','filler','music_offtopic','poi_highlight','exclusive_access','chapter'];
const actionTypes = ['skip','mute','poi','chapter','full'];
const prefix = crypto.createHash('sha256').update(videoId).digest('hex').slice(0, 4);

function qs(params) {
  return new URLSearchParams(params).toString();
}
function repeatedParams(obj) {
  const p = new URLSearchParams();
  if (obj.videoID) p.set('videoID', obj.videoID);
  if (obj.prefix) p.set('prefix', obj.prefix);
  p.set('service', 'YouTube');
  for (const c of categories) p.append('category', c);
  for (const a of actionTypes) p.append('actionType', a);
  return p.toString();
}
const plans = [
  ['direct_repeated', `${base}/api/skipSegments?${repeatedParams({ videoID: videoId })}`],
  ['direct_json', `${base}/api/skipSegments?${qs({ videoID: videoId, categories: JSON.stringify(categories), actionTypes: JSON.stringify(actionTypes), service: 'YouTube' })}`],
  ['privacy_path_json', `${base}/api/skipSegments/${prefix}?${qs({ categories: JSON.stringify(categories), actionTypes: JSON.stringify(actionTypes), service: 'YouTube' })}`],
  ['privacy_path_repeated', `${base}/api/skipSegments/${prefix}?${repeatedParams({})}`],
  ['privacy_query_json', `${base}/api/skipSegments?${qs({ prefix, categories: JSON.stringify(categories), actionTypes: JSON.stringify(actionTypes), service: 'YouTube' })}`],
];

function normalize(payload) {
  if (!Array.isArray(payload)) return [];
  if (payload.some((entry) => entry && Array.isArray(entry.segments))) {
    const hit = payload.find((entry) => entry && entry.videoID === videoId && Array.isArray(entry.segments));
    return hit ? hit.segments : [];
  }
  return payload;
}

(async () => {
  console.log(`Testing SponsorBlock plans for video ${videoId} (prefix ${prefix})`);
  for (const [name, url] of plans) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'YT-zen-test-harness/3.7.1' } });
      let bodyText = await res.text();
      let parsed = null;
      try { parsed = JSON.parse(bodyText); } catch {}
      const segments = parsed ? normalize(parsed) : [];
      console.log(`\n[${name}] status=${res.status} segments=${segments.length}`);
      if (segments.length) {
        for (const seg of segments.slice(0, 5)) {
          const arr = Array.isArray(seg.segment) ? seg.segment : [seg.startTime, seg.endTime];
          console.log(`  - ${seg.category} ${seg.actionType || 'skip'} ${arr[0]} -> ${arr[1]} ${seg.UUID || ''}`);
        }
      } else {
        console.log(bodyText.slice(0, 240));
      }
    } catch (err) {
      console.log(`\n[${name}] ERROR ${err && err.message ? err.message : err}`);
    }
  }
})();
