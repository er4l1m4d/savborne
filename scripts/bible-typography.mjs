// Append the typography section to the art bible and record the fix in the manifest.
import fs from 'node:fs';
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const deCR = (s) => s.split(CR).join('');

const BF = 'docs/art-bible.md';
let bible = deCR(fs.readFileSync(BF, 'utf8'));
if (bible.includes('## 7. Typography')) { console.log('section 7 already present, skipping'); }
else {
  const frag = deCR(fs.readFileSync('assets-raw/s7-typography.md', 'utf8')).replace(/\s+$/, '');
  bible = bible.replace(/\s+$/, '') + NL + NL + frag + NL;
  fs.writeFileSync(BF, bible);
}

const c = fs.readFileSync(BF, 'utf8');
console.log('bible sections: ' + (c.match(/^## /gm) || []).length);
console.log('  has section 7: ' + c.includes('## 7. Typography'));
console.log('  has tnum table: ' + c.includes('latin subset   56429B   tnum YES'));
console.log('  has the 14-places bug record: ' + c.includes('14 places across 7 files'));
console.log('  uppercase decision recorded: ' + c.includes('Considered and rejected: sentence case'));

const MF = 'assets/manifest.json';
const j = JSON.parse(fs.readFileSync(MF, 'utf8'));
j.typography = {
  decided: '2026-10-30',
  faces: {
    'Silkscreen': '20px and above — titles, wordmark, display. No OpenType features at all, so no changing-value numerals.',
    'Plus Jakarta Sans': 'below 20px — body, labels, and every figure that updates.',
  },
  rejected: 'Space Mono for numerals — a fourth download on a zero-budget mobile app, competing with Silkscreen for the same role. Tabular figures are a feature, not a typeface.',
  headers: 'Uppercase with letter-spacing, as shipped. Sentence case was recommended and overruled by the user; recorded as their call.',
  bugFixed: '.num was applied in 14 places across 7 files and defined nowhere. HP readouts, Turn X of Y, the auto-defend countdown, the NIM balance, XP totals and leaderboard scores all rendered in proportional figures and re-flowed width as values changed.',
  fix: 'src/app/globals.css gains a .num utility pinning the family to Jakarta and enabling tabular figures. tsc --noEmit clean.',
  verifiedNotAssumed: 'font-variant-numeric is a silent no-op without a tnum feature, so scripts/font-features.mjs Brotli-decompresses the self-hosted woff2 and reads the feature tags. Result: Jakarta latin subset HAS tnum and pnum; two secondary Jakarta subsets do not; all four Silkscreen cuts have no OpenType features at all.',
  watchFor: 'Digits are U+0030-0039, inside the latin unicode-range, so the tabulating cut is the one that serves them. Re-run font-features.mjs after any font or subset change, or numerals can silently go proportional again.',
};
j.signedOff.typeRuleConfirmed = '2026-10-30';
j.signedOff.numUtilityDefined = '2026-10-30';
j.signedOff.headersStayUppercase = '2026-10-30';
fs.writeFileSync(MF, JSON.stringify(j, null, 2) + NL);
JSON.parse(fs.readFileSync(MF, 'utf8'));
console.log('manifest updated and re-parsed OK');
