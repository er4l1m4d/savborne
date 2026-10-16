// Fetch Shade preview sheets, report dimensions + color census + grid guess
import fs from 'node:fs';
import zlib from 'node:zlib';
const UA = { 'user-agent': 'Mozilla/5.0' };
const urls = [
  'https://img.itch.zone/aW1nLzY5NjUwNTcucG5n/original/flr83Z.png',
  'https://img.itch.zone/aW1nLzY5NjUwNjAucG5n/original/DleY6m.png',
  'https://img.itch.zone/aW1nLzY5NjUwNjgucG5n/original/4Zq6SW.png',
  'https://img.itch.zone/aW1nLzY5NjUwNzEucG5n/original/JWZXdQ.png',
  'https://img.itch.zone/aW1nLzkwMTI0ODYucG5n/original/Nib3RJ.png',
];
fs.mkdirSync('assets-raw/shade', { recursive: true });

function ihdr(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), ctype: buf[25] };
}
let i = 0;
for (const u of urls) {
  try {
    const r = await fetch(u, { headers: UA });
    const b = Buffer.from(await r.arrayBuffer());
    if (b.slice(0, 2).toString() !== 'PK' && b[0] === 0x89) {
      const f = `assets-raw/shade/sheet_${i}.png`;
      fs.writeFileSync(f, b);
      const d = ihdr(b);
      console.log(`${f}  ${r.status}  ${d.w}x${d.h}  ctype=${d.ctype}  ${b.length}B`);
    } else console.log(`sheet_${i}: not PNG (${r.status})`);
    i++;
  } catch (e) { console.log(u + ' ERR ' + e.message); }
}
