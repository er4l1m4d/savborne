// Post-verification fixes. Four things the browser pass caught that the gates could not.
//
//  a) a 6th Profile badge card still held 16x16 GOLDEN CROWN ITEM art, because its
//     aria-label was "Golden Crown" with no "badge" token, so the ship sweep missed it.
//     Its card border is DASHED, which is the locked treatment, so it becomes the locked
//     badge state and the label gains ", locked" to match its siblings.
//  b) the Pixel-art gallery has no Badge set group at all, now that badges are a
//     first-class family on their own grid with their own provenance.
//  c) prose says the glyph set is "twelve"; it is fourteen since update + alert landed.
//  d) two notes still instruct whoever picks this up to keep an 8x8 grid. Zero 8x8 svgs
//     exist. Stale instructions in a handoff are worse than none.
import fs from 'node:fs';

const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');
const B = JSON.parse(fs.readFileSync('assets/badges.json', 'utf8'));
const NAMES = {
  first_steps: 'First Steps', week_warrior: 'Week Warrior', iron_saver: 'Iron Saver',
  steady_hand: 'Steady Hand', first_blade: 'First Blade', golden_crown: 'Golden Crown',
};
const SRCNAME = Object.fromEntries(Object.entries(B).map(([k, v]) => [k, v.source.match(/:([a-z-]+)/)[1]]));
const edits = [];
const at = (idx, len, text, note) => edits.push({ at: idx, len, text, note });

// -- (a) the missed card
const strayRe = /<svg\b[^>]*viewBox="0 0 16 16"[^>]*aria-label="Golden Crown"[^>]*>[\s\S]*?<\/svg>|<svg\b[^>]*aria-label="Golden Crown"[^>]*viewBox="0 0 16 16"[^>]*>[\s\S]*?<\/svg>/g;
const strays = [...h.matchAll(strayRe)];
console.log(`(a) 16x16 "Golden Crown" badge-card instances: ${strays.length} (expect 1)`);
if (strays.length !== 1) throw new Error('expected exactly one - refusing to guess which card to fix');
for (const m of strays) {
  const card = h.slice(Math.max(0, m.index - 300), m.index);
  if (!/border: 2px dashed/.test(card)) throw new Error('the card around it is not dashed - the locked assumption is wrong, refusing to write');
  const tag = `<svg width="48" height="48" viewBox="0 0 24 24" role="img" aria-label="Golden Crown badge, locked" shape-rendering="crispEdges" style="image-rendering:pixelated">${B.golden_crown.states.locked}</svg>`;
  at(m.index, m[0].length, tag, 'Golden Crown card: 16x16 item art -> 24x24 locked badge @48');
}

// -- (c) "twelve" -> "fourteen"
const NEEDLE12 = 'below for the twelve and their sources';
const twelveAt = h.indexOf(NEEDLE12);
console.log(`(c) stale glyph count found at ${twelveAt} (expect >= 0)`);
if (twelveAt < 0) throw new Error('could not locate the "twelve" prose - refusing to guess');
at(twelveAt, NEEDLE12.length, 'below for the fourteen and their sources', 'twelve -> fourteen');

// -- (d) stale 8x8 instructions
const NOTE1 = 'item art (8 items) and the character sprite are placeholders in this file. Swap in final art; keep the 8\u00d78 grid scaled in whole multiples (4\u00d7, 5\u00d7). Screens below show a simple stand-in sprite.';
const NEW1 = 'item art (8 items) and the character sprites are placeholders in this file. Items and characters are <b>16\u00d716</b>; UI chrome glyphs and badges are <b>24\u00d724</b>. Swap in final art keeping each family on its own grid, scaled in WHOLE multiples only (16\u219248/96, 24\u219248/72) \u2014 36px and 18px are not whole multiples of either and produce uneven pixels. See the Icon set, UI glyph set, Badge set, Character sprites and Item art groups below.';
const NOTE2 = 'Item art = clearly marked PIXEL PLACEHOLDERS (8\u00d78). Swap with final art before launch; keep 8\u00d78 grid, 4\u00d7 scale.';
const NEW2 = 'Item art = clearly marked PIXEL PLACEHOLDERS at <b>16\u00d716</b>, shown at 48px (3\u00d7). Swap with final art before launch; keep the 16\u00d716 grid and whole-multiple scales only.';
for (const [label, needle, repl] of [['note', NOTE1, NEW1], ['checklist', NOTE2, NEW2]]) {
  const i = h.indexOf(needle);
  console.log(`(d) stale ${label} 8x8 instruction at ${i} (expect >= 0)`);
  if (i < 0) throw new Error(`stale ${label} text not found verbatim - refusing to guess at a rewrite`);
  at(i, needle.length, repl, `rewrote stale 8x8 ${label}`);
}

// -- (b) Badge set gallery group, inserted before the "Character sprites" heading
const anchor = h.indexOf('Character sprites');
if (anchor < 0) throw new Error('no "Character sprites" heading to insert before');
const headingStart = h.lastIndexOf('<h3', anchor);
if (headingStart < 0) throw new Error('could not find the heading start');
const card = (k) => {
  const states = ['earned', 'locked', 'removed'].map((st) => {
    const svg = `<svg width="48" height="48" viewBox="0 0 24 24" role="img" aria-label="${NAMES[k]} badge, ${st}" shape-rendering="crispEdges" style="image-rendering:pixelated">${B[k].states[st]}</svg>`;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${svg}<span style="font-size:9px;color:#A9B8B2;font-weight:600">${st}</span></div>`;
  }).join('');
  const label = `<span style="font-size:12px;font-weight:600;color:#F3EEDD">${NAMES[k]}</span>`;
  const src = `<span style="font-size:10px;color:#A9B8B2;font-weight:500;text-align:center">pixelarticons:${SRCNAME[k]} (MIT) \u00b7 one drawing, three ramps</span>`;
  return `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px"><div style="display:flex;gap:10px;align-items:flex-end">${states}</div>${label}${src}</div>`;
};
const blurb = '<h3>Badge set</h3><p style="color:#A9B8B2;max-width:760px">Six badges, <b>24\u00d724</b>, from <a href="https://pixelarticons.com">pixelarticons</a> (MIT \u00a9 Gerrit Halfmann) at their native grid \u2014 the same sourcing decision as the UI glyphs, taken after hand-drawn attempts failed to read. A badge is a <b>flat pictogram</b>, not a roundel and ribbon. Earned, locked and removed are <b>one drawing with a different ramp plus a corner chip</b>, so the three states survive grayscale and not just colour: locked carries a minus chip, removed a cross chip, both punched out of the lower right so the pictogram underneath stays intact. Display at 48px on the Profile card, 72px in a large pixel panel, 24px inline in a leaderboard row \u2014 all whole multiples.</p>';
const group = `${blurb}<div class="cards">${Object.keys(B).map(card).join('')}</div>`;
at(headingStart, 0, group, 'inserted the Badge set gallery group');

console.log(`\n${edits.length} edits:`);
for (const e of edits) console.log(`  @${e.at} ${e.note}`);
if (DRY) { console.log('--plan: nothing written'); process.exit(0); }

edits.sort((a, b) => b.at - a.at);
for (const e of edits) h = e.len === 0 ? h.slice(0, e.at) + e.text + h.slice(e.at) : h.slice(0, e.at) + e.text + h.slice(e.at + e.len);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
const sp = (h.match(/<span\b/g) || []).length, spc = (h.match(/<\/span>/g) || []).length;
const fig = (h.match(/<figure\b/g) || []).length, figc = (h.match(/<\/figure>/g) || []).length;
for (const [t, o, c] of [['div', dv, dvc], ['svg', sv, svc], ['span', sp, spc], ['figure', fig, figc]]) {
  if (o !== c) throw new Error(`${t} mismatch ${o}/${c} - refusing to write`);
}
if (/viewBox="0 0 8 8"/.test(h)) throw new Error('an 8x8 survived');
fs.writeFileSync(F, h);
console.log(`\nwrote ${edits.length} edits · div ${dv}/${dvc} · svg ${sv}/${svc} · span ${sp}/${spc} · figure ${fig}/${figc}`);
