// Does each shipped font actually contain a `tnum` (tabular figures) OpenType feature?
//
// Why this matters: the type rule says "tabular numerals". `font-variant-numeric:
// tabular-nums` and `font-feature-settings:"tnum"` are BOTH no-ops unless the font ships
// that feature. Asserting it without checking is the exact failure mode that cost two
// rewrites of art-bible sections 4 and 6 today.
//
// Method: a woff2 file's compressed block is the last `totalCompressedSize` bytes (offset 20
// in the 48-byte header). Feature records store their tags as raw ASCII, so after Brotli
// decompression the presence of "tnum" / "lnum" / "pnum" is directly searchable. No font
// parser required.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const dirs = ['.next', 'node_modules/.cache'].filter((d) => fs.existsSync(d));
const files = [];
for (const d of dirs) {
  const walk = (p) => {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) { try { walk(full); } catch (err) {} }
      else if (e.name.endsWith('.woff2')) files.push(full);
    }
  };
  try { walk(d); } catch (err) {}
}
const uniq = [...new Set(files.map((f) => path.basename(f)))];
console.log(`found ${files.length} woff2 files (${uniq.length} distinct names)\n`);

const FEATURES = ['tnum', 'lnum', 'pnum', 'onum', 'ss01', 'cv01'];
const seen = new Set();
for (const f of files) {
  const buf = fs.readFileSync(f);
  if (buf.slice(0, 4).toString('ascii') !== 'wOF2') continue;
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  // The compressed block normally ends at EOF, but woff2 allows trailing metadata and
  // private data, which breaks that assumption. Recover by probing every plausible
  // directory end and keeping the largest stream that actually decompresses.
  const dirMin = 48, dirMax = 48 + numTables * 14;
  let data = null;
  const cands = new Set([buf.length - totalCompressed]);
  for (let o = dirMin; o <= dirMax; o++) cands.add(o);
  for (const start of cands) {
    if (start < 0 || start >= buf.length) continue;
    try {
      const d = zlib.brotliDecompressSync(buf.slice(start));
      if (d.length > 512 && (!data || d.length > data.length)) data = d;
    } catch (err) { /* not a brotli stream at this offset */ }
  }
  if (!data) { console.log(`${path.basename(f)}  DECOMPRESS FAILED at every candidate offset`); continue; }

  // font family from the name table: search for a plausible ASCII name
  const s = data.toString('latin1');
  const names = [...s.matchAll(/([A-Za-z][A-Za-z &\-]{3,28})/g)].map((m) => m[1]);
  const guess = names.sort((a, b) => b.length - a.length)[0] || '(?)';
  const feats = FEATURES.filter((ft) => s.includes(ft));
  const hasGSUB = s.includes('GSUB') || s.includes('gdef') || /[\s\S]{0,4}GSUB/.test(s);
  const key = path.basename(f);
  if (seen.has(key)) continue;
  seen.add(key);

  console.log(`${key}`);
  console.log(`   tables=${numTables}  decompressed=${data.length}B  first-ascii="${guess.trim()}"`);
  console.log(`   OpenType features found: ${feats.length ? feats.join(', ') : '(none of ' + FEATURES.join(', ') + ')'}`);
  console.log(`   -> tabular figures (tnum): ${feats.includes('tnum') ? 'YES' : 'NO'}`);
}

console.log('\n=== what this means for the rule ===');
console.log('If tnum is absent, `font-variant-numeric: tabular-nums` does nothing and the');
console.log('countdown will still jitter. The robust fix is then a min-width in ch units,');
console.log('which is font-independent, with tabular-nums kept as progressive enhancement.');
