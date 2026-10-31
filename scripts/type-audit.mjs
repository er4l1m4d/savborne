// Stream 3 audit: does the codebase actually obey the type rule that was just written?
// Two violations to look for:
//   1. Silkscreen applied below 20px — where it should be Jakarta, and where its lack of
//      OpenType features would matter if the text ever contains a changing number.
//   2. A number that updates on screen without .num, i.e. still jittering.
// Reading the code, not the spec — that has been the failure mode today.
import fs from 'node:fs';
import path from 'node:path';

const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() && e.name !== 'api' ? walk(path.join(p, e.name))
    : (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) ? [path.join(p, e.name)] : []);
const files = walk('src');

const sizeOf = (s) => {
  const t = s.match(/\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl|\[[\d.]+px\])/);
  if (!t) return null;
  const map = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 };
  if (map[t[1]] !== undefined) return map[t[1]];
  return parseFloat(t[1].slice(1, -1));
};

console.log('=== 1. Silkscreen below 20px (rule violation) ===');
let bad = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/className=\{?"([^"]*)"[^>]*font-silkscreen|font-silkscreen[^}]*?\n?\s*(?:className=\{?"([^"]*"))?/g)) {
    const cls = m[1] || m[2] || '';
    const sz = sizeOf(cls);
    if (sz !== null && sz < 20) { bad++; console.log(`  ${f}: ${sz}px with Silkscreen  ->  ${cls.slice(0, 70)}`); }
  }
  // simpler and more reliable: any element with the inline silkscreen style
  for (const m of s.matchAll(/className="([^"]*)"[\s\S]{0,120}?fontFamily:\s*'var\(--font-silkscreen\)'/g)) {
    const sz = sizeOf(m[1]);
    if (sz !== null && sz < 20) { bad++; console.log(`  ${f}: ${sz}px with Silkscreen  ->  ${m[1].slice(0, 70)}`); }
    else if (sz === null) console.log(`  ${f}: size unclear, check by eye  ->  ${m[1].slice(0, 60)}`);
  }
}
if (!bad) console.log('  none found');

console.log('\n=== 2. Updating numbers without .num ===');
// anything interpolating a variable that looks like a live figure, without the num class
const NUMISH = /\{(secondsLeft|battle\.currentTurn|myHp|foeHp|nim\.toFixed|earned|waitedSeconds|xpToNext|inLevel|r\.score)\b/;
let missed = 0;
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  const lines = s.split(String.fromCharCode(10));
  lines.forEach((l, i) => {
    if (!NUMISH.test(l)) return;
    const window = lines.slice(Math.max(0, i - 3), i + 2).join(' ');
    if (!/\bnum\b/.test(window)) { missed++; console.log(`  ${f}:${i + 1}  ${l.trim().slice(0, 78)}`); }
  });
}
if (!missed) console.log('  none found');

console.log('\n=== 3. .num count now, and is it defined ===');
const uses = files.reduce((n, f) => n + [...fs.readFileSync(f, 'utf8').matchAll(/className="[^"]*\bnum\b[^"]*"/g)].length, 0);
console.log(`  .num used ${uses} times`);
console.log(`  .num defined in globals.css: ${/\.num\s*\{/.test(fs.readFileSync('src/app/globals.css', 'utf8'))}`);
