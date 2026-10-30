// Ship the adopted 24x24 glyph set into Savborne-handoff.html, replacing every 12x12
// instance, and rebuild the glyph gallery so it shows the whole set instead of half of it.
//   --plan   print what each instance maps to, change nothing
//
// Two passes, deliberately. Pass 1 replaces the in-screen instances back-to-front so no
// index goes stale. Pass 2 then re-locates the gallery cards in the MUTATED document —
// their offsets from pass 1 are meaningless by then — and swaps the six object-labelled
// cards for all twelve, labelled by function.
import fs from 'node:fs';

const ART = JSON.parse(fs.readFileSync('assets/glyphs.json', 'utf8'));
let h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const PLAN = process.argv.includes('--plan');

// Shapes are identified in first-appearance order, which is how they were catalogued.
// The six gallery-labelled ones are asserted, so a drifted document fails loudly instead
// of silently mapping a glyph onto the wrong meaning.
const ORDER = ['back', 'check', 'lock', 'leave', 'shield', 'bag', 'flag', 'swords', 'friend', 'special', 'withdrawal'];
const EXPECT_GALLERY = ['back', 'check', 'lock', 'leave', 'shield', 'bag'];
const RESOLVE = { back: 'back', check: 'check', lock: 'lock', leave: 'leave', shield: 'defend', bag: 'useItem', flag: 'flag', swords: null, friend: 'friend', special: 'special', withdrawal: 'withdrawal' };

const sigOf = (el) => {
  const g = Array.from({ length: 12 }, () => Array(12).fill(0));
  for (const p of el.matchAll(/d="([^"]*)"/g))
    for (const r of p[1].matchAll(/M(\d+) (\d+)h(\d+)/g))
      for (let i = 0; i < Number(r[3]); i++) g[Number(r[2])][Number(r[1]) + i] = 1;
  return g.map((r) => r.join('')).join('|');
};
const enclosingText = (doc, idx) => {
  const bo = doc.lastIndexOf('<button', idx), bc = doc.lastIndexOf('</button>', idx);
  return bo > bc ? doc.slice(bo, doc.indexOf('</button>', idx) + 9).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
};

const sigs = [], insts = [];
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)) {
  const el = m[0], sig = sigOf(el);
  let ix = sigs.indexOf(sig);
  if (ix < 0) {
    ix = sigs.length; sigs.push(sig);
    const gal = (/^\s*<code>([^<]+)<\/code>/.exec(h.slice(m.index + el.length, m.index + el.length + 60)) || [, ''])[1];
    if (ix < EXPECT_GALLERY.length && gal !== EXPECT_GALLERY[ix])
      throw new Error(`shape #${ix} expected gallery label "${EXPECT_GALLERY[ix]}", found "${gal}" — the document has drifted, refusing to guess`);
  }
  insts.push({ at: m.index, el, ix, shape: ORDER[ix], text: enclosingText(h, m.index) });
}
if (sigs.length !== ORDER.length) throw new Error(`found ${sigs.length} unique shapes, expected ${ORDER.length}`);

const resolve = (i) => i.shape === 'swords' ? (/Attack/.test(i.text) ? 'attack' : 'ranked') : RESOLVE[i.shape];
const isGallery = (i) => /^\s*<code>(back|check|lock|leave|shield|bag)<\/code>/.test(h.slice(i.at + i.el.length, i.at + i.el.length + 40));

console.log(`${insts.length} instances of ${sigs.length} shapes`);
for (const i of insts) console.log(`  ${i.shape.padEnd(11)} -> ${resolve(i).padEnd(11)} ${isGallery(i) ? '[GALLERY CARD]' : ''} ${i.text.slice(0, 44) || '(icon-only / not in a button)'}`);
if (PLAN) process.exit(0);

// ---- pass 1: in-screen instances, back to front ----
const newAttrs = (i, key) => {
  const w = (i.el.match(/width="(\d+)"/) || [, '24'])[1];
  const hh = (i.el.match(/height="(\d+)"/) || [, w])[1];
  const aria = (i.el.match(/aria-label="([^"]*)"/) || [, ''])[1];
  const cls = (i.el.match(/class="([^"]*)"/) || [, ''])[1];
  const st = (i.el.match(/style="([^"]*)"/) || [, ''])[1];
  return [
    `width="${w}"`, `height="${hh}"`, cls && `class="${cls}"`,
    `aria-label="${aria || key}"`, 'aria-hidden="true"', 'focusable="false"',
    `viewBox="${ART[key].viewBox}"`, st && `style="${st}"`,
  ].filter(Boolean).join(' ');
};
let swapped = 0;
for (const i of insts.slice().reverse()) {
  if (isGallery(i)) continue;
  const key = resolve(i);
  if (!ART[key]) throw new Error(`no glyph art for ${key}`);
  const next = `<svg ${newAttrs(i, key)}>${ART[key].paths}</svg>`;
  h = h.slice(0, i.at) + next + h.slice(i.at + i.el.length);
  swapped++;
}

// ---- pass 2: rebuild the gallery from the mutated document ----
const GALLERY = ['back', 'check', 'lock', 'leave', 'defend', 'useItem', 'attack', 'ranked', 'friend', 'special', 'flag', 'withdrawal'];
const CAPS = {
  back: 'back', check: 'check', lock: 'locked', leave: 'leave / dismiss', defend: 'Defend (action)',
  useItem: 'Use item (action)', attack: 'Attack (action)', ranked: 'Ranked', friend: 'Friend',
  special: 'Special Move', flag: 'Report / forfeit', withdrawal: 'Withdraw (outgoing)',
};
const galleryEls = [...h.matchAll(/<svg\b[^>]*viewBox="0 0 12 12"[^>]*>[\s\S]*?<\/svg>/g)]
  .filter((m) => /^\s*<code>(back|check|lock|leave|shield|bag)<\/code>/.test(h.slice(m.index + m[0].length, m.index + m[0].length + 40)));
if (galleryEls.length !== 6) throw new Error(`expected 6 gallery cards left for pass 2, found ${galleryEls.length}`);
const gStart = h.lastIndexOf('<div class="card"', galleryEls[0].index);
const gEndTag = h.indexOf('</div>', h.indexOf('<code>bag</code>', galleryEls[galleryEls.length - 1].index));
if (gStart < 0 || gEndTag < 0) throw new Error('could not bound the gallery card range');
const cards = GALLERY.map((k) => `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px"><svg width="48" height="48" viewBox="${ART[k].viewBox}" role="img" aria-label="${CAPS[k]}" style="color:#F3EEDD">${ART[k].paths}</svg><code>${CAPS[k]}</code></div>`).join('');
h = h.slice(0, gStart) + cards + h.slice(gEndTag + 6);

// ---- structural guards: refuse to write a broken document ----
const open = (h.match(/<svg\b/g) || []).length;
const close = (h.match(/<\/svg>/g) || []).length;
if (open !== close) throw new Error(`svg tag mismatch after ship: ${open} open vs ${close} close — refusing to write`);
const left = (h.match(/viewBox="0 0 12 12"/g) || []).length;
if (left) throw new Error(`${left} 12x12 glyph instances remain after ship — refusing to write`);

fs.writeFileSync('Savborne-handoff.html', h);
console.log(`\nswapped ${swapped} in-screen instances, gallery rebuilt with ${GALLERY.length} cards`);
console.log(`svg tags balanced: ${open} open / ${close} close · zero 12x12 remaining`);
