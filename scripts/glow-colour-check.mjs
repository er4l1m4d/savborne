// Does the gilt #FEE761 that glow would use already mean something on a battle screen?
// Counted with node, not the search tool — the handoff is one enormous line and ripgrep
// silently returned zero for a colour I can see in the rendered badges.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const marks = [...h.matchAll(/id="(A_[A-Za-z]+)"/g)];
const secs = marks.map((m, i) => ({ id: m[1], from: m.index, to: i + 1 < marks.length ? marks[i + 1].index : h.length }));

for (const col of ['#FEE761', '#6FD0AE', '#C9C1A8', '#F2735A', '#BD6C4A']) {
  const total = (h.match(new RegExp(col.replace('#', '#'), 'g')) || []).length;
  const inBattle = secs.filter((s) => /Battle|InBattleWait|Win|Loss|Tie|ConnLost|ItemSheet/.test(s.id))
    .reduce((n, s) => n + ((h.slice(s.from, s.to).match(new RegExp(col, 'g')) || []).length), 0);
  console.log(`${col}  total ${String(total).padStart(4)}  on battle screens ${String(inBattle).padStart(3)}`);
}
console.log('\n--- sanity: does the tool-agnostic count find the badge gold at all? ---');
const badge = [...h.matchAll(/aria-label="([^"]*badge[^"]*)"/g)];
console.log(`badge instances in the doc: ${badge.length}`);
const first = badge[0];
const tag = h.slice(first.index - 200, first.index + 900);
console.log('fills in the first badge instance:', [...new Set([...tag.matchAll(/fill="(#[0-9A-F]{6})"/g)].map((m) => m[1]))].join(' ') || '(none found in window)');
console.log('\n--- which sections contain each battle-relevant colour ---');
for (const s of secs) {
  const body = h.slice(s.from, s.to);
  const hits = ['#FEE761', '#6FD0AE', '#F2735A'].filter((c) => body.includes(c));
  if (hits.length) console.log(`  ${s.id.padEnd(18)} ${hits.join(' ')}`);
}
