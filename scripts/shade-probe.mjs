// Probe Shade's itch.io page for real file URLs
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36' };
const r = await fetch('https://merchant-shade.itch.io/16x16-mixed-rpg-icons', { headers: UA });
const t = await r.text();
console.log('status', r.status, 'len', t.length);
const urls = [...t.matchAll(/https?:\/\/[^"\\\s']+\.(?:zip|png)[^"\\\s']*/gi)].map(m => m[0]);
console.log([...new Set(urls)].slice(0, 20).join('\n'));
// itch embeds file info in JSON
const files = [...t.matchAll(/"(?:url|download_url|file_url)":"([^"]+)"/gi)].map(m => m[1]);
console.log('json urls:', [...new Set(files)].slice(0, 10).join('\n'));
const title = (t.match(/<title>([^<]*)<\/title>/) || [])[1];
console.log('title:', title);
