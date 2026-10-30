// Fix the accessibility attributes on the shipped 24x24 glyphs.
// The old doc pattern was aria-hidden="true" with no label, which is correct inside a
// button that carries visible text and wrong for an icon-only button, where the glyph is
// the only name the control has. The ship pass stamped aria-hidden AND aria-label on
// everything, so an icon-only back button now announces nothing at all.
// Rule: inside a button with text -> aria-hidden, no label. Alone -> labelled, not hidden.
import fs from 'node:fs';
let h = fs.readFileSync('Savborne-handoff.html', 'utf8');

const GLYPHS = ['back', 'check', 'lock', 'leave', 'defend', 'useItem', 'attack', 'ranked', 'friend', 'special', 'flag', 'withdrawal'];
const NAMES = {
  back: 'Back', check: 'Completed', lock: 'Locked', leave: 'Close', defend: 'Defend', useItem: 'Use item',
  attack: 'Attack', ranked: 'Ranked', friend: 'Challenge a friend', special: 'Special move',
  flag: 'Report or forfeit', withdrawal: 'Withdraw',
};

// Collect first, then edit back-to-front: every replacement changes the tag's length, so
// forward iteration would write at stale offsets.
const targets = [];
for (const m of h.matchAll(/<svg\b[^>]*viewBox="0 0 24 24"[^>]*>/g)) {
  const key = GLYPHS.find((k) => new RegExp(`aria-label="${k}"`).test(m[0]));
  if (key) targets.push({ at: m.index, tag: m[0], key });
}
let hidden = 0, named = 0;
for (const t of targets.reverse()) {
  const bo = h.lastIndexOf('<button', t.at), bc = h.lastIndexOf('</button>', t.at);
  const inButton = bo > bc;
  const btnText = inButton
    ? h.slice(bo, h.indexOf('</button>', t.at)).replace(/<svg\b[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : '';
  // strip both attributes, then add back exactly one form — never role twice
  let next = t.tag.replace(/\s+aria-hidden="true"/g, '').replace(/\s+aria-label="[^"]*"/g, '').replace(/\s+role="img"/g, '');
  if (inButton && btnText) {
    next = next.replace(/>$/, ' aria-hidden="true">');
    hidden++;
  } else {
    next = next.replace(/>$/, ` role="img" aria-label="${NAMES[t.key]}">`);
    named++;
  }
  if (next !== t.tag) h = h.slice(0, t.at) + next + h.slice(t.at + t.tag.length);
}

const open = (h.match(/<svg\b/g) || []).length;
const close = (h.match(/<\/svg>/g) || []).length;
if (open !== close) throw new Error(`svg tag mismatch: ${open} vs ${close} — refusing to write`);
fs.writeFileSync('Savborne-handoff.html', h);
console.log(`glyph svgs: ${hidden} kept aria-hidden inside a labelled button, ${named} given a real accessible name`);
console.log(`svg tags balanced: ${open} / ${close}`);
