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
// MERGE, never replace. Each pass appends its own record to typography
// (measured, pass1, pass2, pass3); assigning a fresh object here silently
// deleted all of them on every run. See ERRORS.md 2026-11-02.
j.typography = {
  ...j.typography,
  decided: '2026-10-30',
  faces: {
    'Silkscreen': '20px and above — titles, wordmark, display numerals at 20px or more, whether or not the value changes. No OpenType features at all, so it can never carry tabular figures.',
    'Plus Jakarta Sans': 'below 20px — body, labels, and every figure that updates below 20px.',
  },
  rejected: 'Space Mono for numerals — a fourth download on a zero-budget mobile app, competing with Silkscreen for the same role. Tabular figures are a feature, not a typeface.',
  headers: 'Uppercase with letter-spacing, as shipped. Sentence case was recommended and overruled by the user; recorded as their call.',
  bugFixed: '.num was applied in 14 places across 7 files and defined nowhere. HP readouts, Turn X of Y, the auto-defend countdown, the NIM balance, XP totals and leaderboard scores all rendered in proportional figures and re-flowed width as values changed.',
  fix: 'src/app/globals.css gains a .num utility pinning the family to Jakarta and enabling tabular figures. tsc --noEmit clean.',
  verifiedNotAssumed: 'font-variant-numeric is a silent no-op without a tnum feature, so scripts/font-features.mjs Brotli-decompresses the self-hosted woff2 and reads the feature tags. Result: Jakarta latin subset HAS tnum and pnum; two secondary Jakarta subsets do not; all four Silkscreen cuts have no OpenType features at all.',
  watchFor: 'Digits are U+0030-0039, inside the latin unicode-range, so the tabulating cut is the one that serves them. Re-run font-features.mjs after any font or subset change, or numerals can silently go proportional again.',
  numScope: 'Corrected 2026-11-02: .num applies to updating figures BELOW 20px only. A numeral at 20px or more is Silkscreen by the pass-3 size rule, and .num on Silkscreen is a silent no-op because it has no tnum feature. The NIM balance is 36px Silkscreen in the artefact, so it is not a .num site in the design of record.',
  balanceBuildGap: 'The app renders the balance as .num text-3xl (Jakarta 30px) in src/app/(tabs)/page.tsx. That is a build gap, not a typography decision — it is also the one shipped size off the 4px grid — recorded here the way the 44px->24px result titles are. The balance-read count-up is likewise not implemented in the app.',
};
j.signedOff.typeRuleConfirmed = '2026-10-30';
j.signedOff.numUtilityDefined = '2026-10-30';
j.signedOff.headersStayUppercase = '2026-10-30';
fs.writeFileSync(MF, JSON.stringify(j, null, 2) + NL);
JSON.parse(fs.readFileSync(MF, 'utf8'));
console.log('manifest updated and re-parsed OK');
