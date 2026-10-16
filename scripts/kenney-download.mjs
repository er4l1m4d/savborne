// Download Kenney Tiny Dungeon (CC0) + extract + file manifest
import fs from 'node:fs';
const url = 'https://opengameart.org/sites/default/files/kenney_tinydungeon.zip';
const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
if (!r.ok) { console.log('FAILED ' + r.status); process.exit(1); }
const buf = Buffer.from(await r.arrayBuffer());
if (buf.slice(0, 2).toString() !== 'PK') { console.log('NOT A ZIP, first bytes: ' + buf.slice(0, 20)); process.exit(1); }
fs.mkdirSync('assets-raw', { recursive: true });
fs.writeFileSync('assets-raw/kenney_tinydungeon.zip', buf);
console.log('saved ' + buf.length + ' bytes');
// license record
fs.writeFileSync('assets-raw/kenney_tinydungeon.LICENSE.txt',
`Pack: Tiny Dungeon (Kenney)
Source page: https://opengameart.org/content/tiny-dungeon  (Kenney-uploaded, license badge: CC0)
Canonical page: https://kenney.nl/assets/tiny-dungeon
File: https://opengameart.org/sites/default/files/kenney_tinydungeon.zip
License: CC0 1.0 Universal — https://creativecommons.org/publicdomain/zero/1.0/
Downloaded: 2026-10-16 by automated fetch for Savborne UI hardening (task 1).
Note: attribution NOT required under CC0; recorded anyway for provenance.`);
console.log('license file written');
