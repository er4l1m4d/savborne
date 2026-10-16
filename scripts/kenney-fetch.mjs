// Kenney raw material acquisition: probe slugs, find real download URLs, save zips
import fs from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36' };
const slugs = ['game-icons', 'input-prompts', 'tiny-dungeon', 'roguelike', 'roguelike-redux', 'pixel-adventure', 'ui-pack'];
fs.mkdirSync('assets-raw', { recursive: true });

async function tryUrl(u) {
  try {
    const r = await fetch(u, { headers: UA, redirect: 'follow' });
    const ct = r.headers.get('content-type') || '';
    const buf = Buffer.from(await r.arrayBuffer());
    const isZip = buf.slice(0, 2).toString() === 'PK';
    console.log(`${r.status} ${isZip ? 'ZIP' : ct.split(';')[0]} ${String(buf.length).padStart(8)}B  ${u}`);
    if (isZip) {
      const name = u.replace(/[^a-z0-9-]+/gi, '_').slice(-60) + '.zip';
      fs.writeFileSync('assets-raw/' + name, buf);
      console.log('   saved -> assets-raw/' + name);
      return true;
    }
    if (ct.includes('html') && r.status === 200) {
      const t = buf.toString();
      const hits = [...t.matchAll(/"(https?:[^"]+\.(?:zip|tgz))"|href="([^"]*download[^"]*)"/gi)].map(m => m[1] || m[2]).slice(0, 6);
      hits.forEach((x) => console.log('   link: ' + x));
    }
    return false;
  } catch (e) { console.log('ERR ' + u + ' ' + e.message); return false; }
}

for (const s of slugs) {
  await tryUrl(`https://kenney.nl/assets/${s}`);
  await tryUrl(`https://kenney.nl/assets/${s}:download`);
  await tryUrl(`https://kenney.nl/media/kenney/${s}.zip`);
}
