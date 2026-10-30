// Ship the 24x24 badge set into Savborne-handoff.html, replacing every 8x8 badge instance.
//
// Sizes are chosen so each is a WHOLE multiple of the 24px art, which none of the current
// sizes are (64/24=2.67, 36/24=1.5, 18/24=0.75):
//   gallery tile   64 -> 72  (3x, inside a 112px frame)
//   profile card   36 -> 48  (2x, inside a 100px card that also holds a label)
//   leaderboard    18 -> 24  (1x, inline with 15px text)
// Matching is by aria-label, so an instance can only be replaced by the badge it names.
import fs from 'node:fs';

const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');
const B = JSON.parse(fs.readFileSync('assets/badges.json', 'utf8'));

const KEY = {
  'First Steps badge, earned': ['first_steps', 'earned'],
  'Week Warrior badge, earned': ['week_warrior', 'earned'],
  'First Blade badge, earned': ['first_blade', 'earned'],
  'Iron Saver badge, locked': ['iron_saver', 'locked'],
  'Steady Hand badge, locked': ['steady_hand', 'locked'],
  'Week Warrior badge, removed': ['week_warrior', 'removed'],
  'Golden Crown badge': ['golden_crown', 'earned'],
};
const SIZE = { 64: 72, 36: 48, 18: 24 };

const re = /<svg\b[^>]*viewBox="0 0 8 8"[^>]*>[\s\S]*?<\/svg>/g;
const all = [...h.matchAll(re)];
const badges = all.filter((m) => /badge/i.test(m[0]));
const strays = all.filter((m) => !/badge/i.test(m[0]));
console.log(`8x8 instances: ${all.length}  badges: ${badges.length}  non-badge chrome: ${strays.length} (${strays.map((m) => (m[0].match(/aria-label="([^"]*)"/) || [, '?'])[1]).join(', ')})`);

const edits = [];
for (const m of badges) {
  const label = (m[0].match(/aria-label="([^"]*)"/) || [, ''])[1];
  const pair = KEY[label];
  if (!pair) throw new Error(`no mapping for aria-label "${label}" — refusing to guess`);
  const [bk, st] = pair;
  if (!B[bk] || !B[bk].states[st]) throw new Error(`assets/badges.json has no ${bk}/${st}`);
  const w = Number((m[0].match(/width="(\d+)"/) || [, '0'])[1]);
  const px = SIZE[w];
  if (!px) throw new Error(`unmapped display size ${w}px for "${label}"`);
  const tag = `<svg width="${px}" height="${px}" viewBox="0 0 24 24" role="img" aria-label="${label}" shape-rendering="crispEdges" style="image-rendering:pixelated">${B[bk].states[st]}</svg>`;
  edits.push({ at: m.index, len: m[0].length, text: tag, note: `${label} ${w}->${px}` });
}
for (const e of edits) console.log(`  ${e.note}`);
if (edits.length !== badges.length) throw new Error('edit count mismatch');

if (DRY) { console.log('--plan: nothing written'); process.exit(0); }

edits.sort((a, b) => b.at - a.at);
for (const e of edits) h = h.slice(0, e.at) + e.text + h.slice(e.at + e.len);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
if (dv !== dvc) throw new Error(`div mismatch ${dv}/${dvc} — refusing to write`);
if (sv !== svc) throw new Error(`svg mismatch ${sv}/${svc} — refusing to write`);
const left = (h.match(/viewBox="0 0 8 8"/g) || []).length;
if (left !== strays.length) throw new Error(`expected ${strays.length} 8x8 to remain (the chrome marks), found ${left} — refusing to write`);
if (/width="36"[^>]*viewBox="0 0 8 8"/.test(h) || /viewBox="0 0 8 8"[^>]*width="36"/.test(h)) throw new Error('a 36px 8x8 badge survived');

fs.writeFileSync(F, h);
console.log(`\nreplaced ${edits.length} badge instances · div ${dv}/${dvc} · svg ${sv}/${svc}`);
console.log(`${left} 8x8 instances remain, all non-badge chrome — handled by the next script`);
