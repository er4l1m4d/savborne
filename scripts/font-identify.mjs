// Which face is which file, and does the specific WEIGHT used for numbers carry tnum?
// Matters because `.num` is applied with font-bold (700) in several places — if tnum exists
// only at 400, bold numerals still jitter and the rule is half-implemented.
// The woff2 name table is stored uncompressed, so family and subfamily strings are directly
// searchable as either UTF-8 or UTF-16BE.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const files = [];
for (const d of ['.next', 'node_modules/.cache']) {
  if (!fs.existsSync(d)) continue;
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) { try { walk(full); } catch (err) {} }
      else if (e.name.endsWith('.woff2')) files.push(full);
    }
  };
  try { walk(d); } catch (err) {}
}

const decode = (buf) => {
  const dirMin = 48, dirMax = 48 + buf.readUInt16BE(12) * 14;
  let best = null;
  for (let o = dirMin; o <= dirMax; o++) {
    if (o < 0 || o >= buf.length) continue;
    try { const d = zlib.brotliDecompressSync(buf.slice(o)); if (d.length > 512 && (!best || d.length > best.length)) best = d; } catch (err) {}
  }
  try { const d = zlib.brotliDecompressSync(buf.slice(buf.length - buf.readUInt32BE(20))); if (d.length > 512 && (!best || d.length > best.length)) best = d; } catch (err) {}
  return best;
};

// Buffer.from(array, 'utf16le') ignores the encoding for arrays and writes one byte per
// element, which made odd-length names produce an odd buffer and blow up swap16.
// Encode from the STRING so each char is two bytes, then byte-swap to big-endian.
const u16 = (s) => Buffer.from(s, 'utf16le').swap16().toString('latin1');
const rows = [];
for (const f of [...new Set(files)]) {
  const buf = fs.readFileSync(f);
  if (buf.slice(0, 4).toString('ascii') !== 'wOF2') continue;
  const data = decode(buf);
  if (!data) continue;
  const s = data.toString('latin1');
  const fam = ['Plus Jakarta Sans', 'Silkscreen'].find((n) => s.includes(n) || s.includes(u16(n))) || 'unknown';
  const weight = s.includes(u16('Bold')) || s.includes('Bold') ? '700' : s.includes('Regular') ? '400' : '?';
  rows.push({
    file: path.basename(f).slice(0, 18),
    fam, weight,
    size: data.length,
    tables: buf.readUInt16BE(12),
    tnum: s.includes('tnum'),
    pnum: s.includes('pnum'),
    lnum: s.includes('lnum'),
  });
}

rows.sort((a, b) => (a.fam + a.weight).localeCompare(b.fam + b.weight));
console.log('family              weight  decompressed  tables  tnum   pnum   lnum');
for (const r of rows) {
  console.log(
    r.fam.padEnd(20) + r.weight.padStart(3) + '   '
    + String(r.size).padStart(9) + '  ' + String(r.tables).padStart(5) + '   '
    + (r.tnum ? 'YES ' : 'no  ') + '  ' + (r.pnum ? 'YES ' : 'no  ') + '  ' + (r.lnum ? 'YES' : 'no')
  );
}
const jak = rows.filter((r) => r.fam === 'Plus Jakarta Sans');
const sil = rows.filter((r) => r.fam === 'Silkscreen');
console.log('\n=== verdict ===');
console.log('Jakarta faces seen: ' + jak.length + '   with tnum: ' + jak.filter((r) => r.tnum).length
  + '   without: ' + jak.filter((r) => !r.tnum).length);
console.log('Silkscreen faces seen: ' + sil.length + '   with tnum: ' + sil.filter((r) => r.tnum).length);
console.log('\nIf Jakarta shows some faces with tnum and some without, the subsets differ —');
console.log('Google Fonts serves per-subset cuts, and only the cut carrying the feature');
console.log('will tabulate. That is exactly why a min-width fallback is the safe rule.');
