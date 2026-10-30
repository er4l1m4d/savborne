// Do the Attack glyph and the First Blade badge ever share a screen?
// Relevant because both are pixelarticons' `sword` — if they co-occur, that is a bible
// rule 6 violation in the same class as the flag collision. If they never do, the shared
// silhouette is a much weaker problem and should be judged as such rather than assumed.
import fs from 'node:fs';

const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const G = JSON.parse(fs.readFileSync('assets/glyphs.json', 'utf8'));
const N = 24;
const setOf = (markup) => {
  const s = new Set();
  for (const m of markup.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g))
    for (let i = 0; i < Number(m[3]); i++) s.add(Number(m[2]) * N + Number(m[1]) + i);
  return s;
};
const sig = (s) => [...s].sort((a, b) => a - b).join(',');
const attackSig = sig(setOf(G.attack.paths));

// split the doc into screen sections by the id'd mock frames
const marks = [...h.matchAll(/id="(A_[A-Za-z]+|[a-z]+-[a-z-]+)"/g)];
const sections = marks.map((m, i) => ({
  id: m[1],
  from: m.index,
  to: i + 1 < marks.length ? marks[i + 1].index : h.length,
}));

const attackScreens = [], badgeScreens = [];
for (const s of sections) {
  const body = h.slice(s.from, s.to);
  for (const m of body.matchAll(/viewBox="0 0 24 24"[^>]*>([\s\S]*?)<\/svg>/g)) {
    if (sig(setOf(m[1])) === attackSig) { attackScreens.push(s.id); break; }
  }
  if (/badge[,;"]|Badges/i.test(body)) badgeScreens.push(s.id);
}
const uniq = (a) => [...new Set(a)];
console.log('screens containing the Attack sword glyph :', uniq(attackScreens).join(', ') || '(none)');
console.log('screens containing badge art or the word badge:', uniq(badgeScreens).join(', ') || '(none)');
const both = uniq(attackScreens).filter((x) => uniq(badgeScreens).includes(x));
console.log('\nCO-OCCUR:', both.length ? `*** ${both.join(', ')} ***` : 'none — the two never appear in the same screen section');
