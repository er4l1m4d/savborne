// Inspect the Kenney :download intermediary page for the actual file URL
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36' };
const r = await fetch('https://kenney.nl/assets/tiny-dungeon:download', { headers: UA });
const t = await r.text();
fs.writeFileSync('assets-raw/probe-download-page.html', t);
import fs from 'node:fs';
console.log('len', t.length);
console.log([...t.matchAll(/(?:https?:\/\/[^"'\s]+|\/[^"'\s]*\.(?:zip|png|js|mjs|json)[^"'\s]*)/gi)].map(m => m[0]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 40).join('\n'));
console.log('--- title/meta:');
console.log((t.match(/<title>[^<]*<\/title>/i) || [''])[0]);
