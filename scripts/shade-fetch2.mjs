// Fetch remaining Shade sheet originals
import fs from 'node:fs';
const UA = { 'user-agent': 'Mozilla/5.0' };
const urls = [
  'https://img.itch.zone/aW1nLzkwMTIxMjQucG5n/original/ElkbkH.png',
  'https://img.itch.zone/aW1nLzkwMTIxMjcucG5n/original/hzWCR7.png',
  'https://img.itch.zone/aW1nLzkwMTIxMzAucG5n/original/2LQB8q.png',
  'https://img.itch.zone/aW1nLzkwMTIxMzgucG5n/original/BDn14q.png',
  'https://img.itch.zone/aW1nLzkwMTIxMzkucG5n/original/CseIoY.png',
  'https://img.itch.zone/aW1nLzkwMTIxNDYucG5n/original/MR8i%2Fh.png',
];
let i = 5;
for (const u of urls) {
  const r = await fetch(u, { headers: UA });
  const b = Buffer.from(await r.arrayBuffer());
  if (b[0] === 0x89) {
    const f = `assets-raw/shade/sheet_${i}.png`;
    fs.writeFileSync(f, b);
    console.log(`${f}  ${r.status}  ${b.readUInt32BE(16)}x${b.readUInt32BE(20)}  ${b.length}B`);
  } else console.log(`sheet_${i}: not PNG ${r.status}`);
  i++;
}
