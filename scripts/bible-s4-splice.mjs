// Splice the rewritten section 4 into the bible. The new text lives in its own .md file
// rather than a JS string, because markdown code spans are backticks.
// No backslash escapes anywhere in this file: the previous revision had its '\n' literals
// converted into real newlines on write, which broke the regex. NL is built from a codepoint.
import fs from 'node:fs';
const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const deCR = (s) => s.split(CR).join('');

const F = 'docs/art-bible.md';
const lines = deCR(fs.readFileSync(F, 'utf8')).split(NL);
const a = lines.findIndex((l) => /^## 4\./.test(l));
const b = lines.findIndex((l, i) => i > a && /^## 5\./.test(l));
if (a < 0 || b < 0) throw new Error('section 4/5 boundaries not found - refusing to rewrite');
console.log('replacing lines ' + (a + 1) + '..' + b + ' (' + (b - a) + ' lines)');

const fresh = deCR(fs.readFileSync('assets-raw/s4-new.md', 'utf8')).split(NL);
while (fresh.length && fresh[fresh.length - 1] === '') fresh.pop();
lines.splice(a, b - a, ...fresh, '');
fs.writeFileSync(F, lines.join(NL));

const c = deCR(fs.readFileSync(F, 'utf8'));
const checks = [
  ['heading revised', c.includes('## 4. Battle state channels')],
  ['1.03:1 recorded', c.includes('measures **1.03:1**')],
  ['bob demoted', c.includes('decoration only, carries no information')],
  ['glow spent on gilt', c.includes('silhouette rim in **`#FEE761`**')],
  ['non-co-occurrence recorded', c.includes('can never co-occur')],
  ['plate-has-no-fill consequence', c.includes('The plate has no fill to dim')],
  ['shipped-state section', c.includes('### Shipped state, verified')],
  ['old mint-lit spec gone', !c.includes('lit = your turn')],
  ['old bob claim gone', !c.includes('bobbing sprite against a still one reads')],
  ['sections are 1,2,2b,3,4,5,6', (c.match(/^## /gm) || []).length === 7],
  ['section 5 intact', /^## 5\./m.test(c)],
  ['section 6 intact', /^## 6\./m.test(c)],
];
console.log(checks.map(([k, v]) => (v ? '  OK   ' : '  FAIL ') + k).join(NL));
if (checks.some(([, v]) => !v)) throw new Error('a post-write check failed');
