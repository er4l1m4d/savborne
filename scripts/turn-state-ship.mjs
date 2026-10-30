// Ship the turn-state treatment into the handoff.
//
// Scope, established by inspection rather than assumption:
//   arenas WITH nameplates   A_Battle, A_InBattleWait, A_ConnLost
//   arenas WITHOUT           A_ItemSheet, A_Win, A_Loss, A_Tie  -> nothing to mark
//   plate interior is #0C1211, the same as the arena since the surface reversal, so the
//   plate is border-only. There is no fill to dim. The border carries the whole signal.
//
// The idle border is solved for the dimmest value that still clears 3:1 against the arena,
// because 2.40:1 (the value used in the rendered proposal) is the same defect we rejected
// in the old badges at 2.32:1.
import fs from 'node:fs';

const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const DRY = process.argv.includes('--plan');
const ARENA = '#0C1211', ACTING = '#C9C1A8', PLATE_TEXT = '#A9B8B2';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

// Prefer an EXISTING palette colour for the idle border over a computed blend — a new
// off-palette hex is exactly what the section 2 census work exists to prevent.
// Requirement: >=3:1 against the arena (so the plate is still a plate) and clearly
// recessive against the acting border.
const PACK = ['#8B9BB4', '#C0CBDC', '#AAB7CC', '#E4EDF9', '#52607C', '#5A6988', '#262B44', '#4B5A56', '#2E4642', '#A9B8B2', '#3F2631'];
const candidates = PACK
  .map((c) => ({ c, vsArena: ratio(c, ARENA), vsActing: ratio(ACTING, c) }))
  .filter((x) => x.vsArena >= 3 && x.vsActing >= 2.5)
  .sort((a, b) => b.vsArena - a.vsArena);          // dimmest that still clears both
for (const x of candidates) console.log(`  candidate ${x.c}: ${x.vsArena.toFixed(2)}:1 vs arena, ${x.vsActing.toFixed(2)}:1 vs acting`);
const IDLE = candidates.length ? candidates[candidates.length - 1].c : (() => {
  for (let t = 0.95; t > 0; t -= 0.01) { const c = mix(ACTING, ARENA, t); if (ratio(c, ARENA) >= 3) return c; }
  return ACTING;
})();
console.log(`\nidle border = ${IDLE} (${candidates.length ? 'existing palette colour' : 'computed blend, no palette colour qualified'})`);
console.log(`acting border ${ACTING} vs arena: ${ratio(ACTING, ARENA).toFixed(2)}:1`);
console.log(`acting vs idle — the turn signal itself: ${ratio(ACTING, IDLE).toFixed(2)}:1   (was 1.03:1 mint-vs-cream)`);
console.log(`(the rendered proposal used #545147 = ${ratio('#545147', ARENA).toFixed(2)}:1 — under 3:1, not shipped)`);
const DIM_SPRITE = 0.62;

const TAG = (text, colour) => `<span style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${colour}">${text}</span>`;

// Each edit is (arena, how to find the plate, new style, tag to append before </div>).
// Plates are identified by their position declaration, which inspection confirmed is
// unique per arena: left/top = rival, right/bottom = hero.
// `sprite` means DIM THIS SPRITE, so it belongs on the row whose plate is recessive.
// A_Battle is the player's turn: the rival dims, the player does not.
const PLAN = [
  { arena: 'A_Battle', plate: 'left: 14px; top: 14px', to: 'idle',   tag: null,                 sprite: 'Opponent: Mint Wraith' },
  { arena: 'A_Battle', plate: 'right: 14px; bottom: 36px', to: 'acting', tag: 'YOUR MOVE', sprite: null },
  { arena: 'A_InBattleWait', plate: 'left: 14px; top: 14px', to: 'acting', tag: 'THEIRS', sprite: null },
  { arena: 'A_InBattleWait', plate: 'right: 14px; bottom: 36px', to: 'hatched', tag: 'ACTED', sprite: 'You: Kemi' },
  { arena: 'A_ConnLost', plate: 'left: 14px; top: 14px', to: 'neutral', tag: null, sprite: null },
  { arena: 'A_ConnLost', plate: 'right: 14px; bottom: 36px', to: 'offline', tag: 'OFFLINE', sprite: null },
];

const marks = [...h.matchAll(/id="(A_[A-Za-z]+)"/g)];
const secs = marks.map((m, i) => ({ id: m[1], from: m.index, to: i + 1 < marks.length ? marks[i + 1].index : h.length }));
const edits = [];

for (const p of PLAN) {
  const sec = secs.find((s) => s.id === p.arena);
  if (!sec) throw new Error(`arena ${p.arena} not found`);
  const body = h.slice(sec.from, sec.to);

  // locate the plate's style attribute
  const needle = `style="position: absolute; ${p.plate.replace(/; /g, '; ')}; width: 168px; box-sizing: border-box; padding: 10px 12px; background: #0C1211; border: 2px solid #C9C1A8;`;
  const at = body.indexOf(needle);
  if (at < 0) throw new Error(`${p.arena}: plate "${p.plate}" not found — markup differs from the inspection`);

  let newStyle;
  if (p.to === 'acting') {
    newStyle = needle.replace('border: 2px solid #C9C1A8;', `border: 4px solid ${ACTING};`);
  } else if (p.to === 'idle') {
    newStyle = needle.replace('border: 2px solid #C9C1A8;', `border: 2px solid ${IDLE};`);
  } else if (p.to === 'hatched') {
    newStyle = needle.replace('border: 2px solid #C9C1A8;', `border: 2px dashed ${IDLE};`);
  } else if (p.to === 'offline') {
    newStyle = needle.replace('border: 2px solid #C9C1A8;', `border: 2px solid ${IDLE};`);
  } else {
    newStyle = needle;
  }
  edits.push({ at: sec.from + at, len: needle.length, text: newStyle, note: `${p.arena} plate ${p.plate.split(';')[0]} -> ${p.to}` });

  if (p.tag) {
    // append the tag inside the plate: find the plate's last HP readout span close
    const seg = body.slice(at, at + 1600);
    const hpAt = seg.search(/<span style="font-size: 12px; color: #A9B8B2[^<]*<\/span>/);
    if (hpAt < 0) throw new Error(`${p.arena}: no HP readout span to place the "${p.tag}" tag beside`);
    const insertAt = at + hpAt + (seg.match(/<span style="font-size: 12px; color: #A9B8B2[^<]*<\/span>/)[0].length);
    const colour = p.to === 'acting' ? ACTING : p.tag === 'OFFLINE' ? '#F2735A' : PLATE_TEXT;
    edits.push({ at: sec.from + insertAt, len: 0, text: TAG(p.tag, colour), note: `${p.arena} + tag ${p.tag}` });
  }

  if (p.sprite) {
    // prefix match: the real label is "Opponent: Mint Wraith (one of four rolled per
    // battle)", so an exact equality test would never hit
    const sAt = body.indexOf(`aria-label="${p.sprite}`);
    if (sAt < 0) throw new Error(`${p.arena}: sprite "${p.sprite}" not found`);
    const styleAt = body.indexOf('style="', sAt);
    const styleEnd = body.indexOf('"', styleAt + 7);
    const style = body.slice(styleAt, styleEnd + 1);
    if (/opacity:/.test(style)) throw new Error(`${p.arena}: sprite already has an opacity — refusing to overwrite`);
    edits.push({ at: sec.from + styleAt, len: style.length, text: style.slice(0, -1) + `; opacity: ${DIM_SPRITE}"`, note: `${p.arena} sprite "${p.sprite}" -> opacity ${DIM_SPRITE}` });
  }
}

console.log(`\n${edits.length} edits:`);
for (const e of edits) console.log(`  @${e.at} ${e.note}`);
if (DRY) { console.log('\n--plan: nothing written'); process.exit(0); }

edits.sort((a, b) => b.at - a.at);
for (const e of edits) h = e.len === 0 ? h.slice(0, e.at) + e.text + h.slice(e.at) : h.slice(0, e.at) + e.text + h.slice(e.at + e.len);

const dv = (h.match(/<div\b/g) || []).length, dvc = (h.match(/<\/div>/g) || []).length;
const sv = (h.match(/<svg\b/g) || []).length, svc = (h.match(/<\/svg>/g) || []).length;
const sp = (h.match(/<span\b/g) || []).length, spc = (h.match(/<\/span>/g) || []).length;
for (const [t, o, c] of [['div', dv, dvc], ['svg', sv, svc], ['span', sp, spc]]) {
  if (o !== c) throw new Error(`${t} mismatch ${o}/${c} — refusing to write`);
}
for (const want of ['YOUR MOVE', 'THEIRS', 'ACTED', 'OFFLINE']) {
  if (!h.includes(`>${want}</span>`)) throw new Error(`tag ${want} did not land — refusing to write`);
}
fs.writeFileSync(F, h);
console.log(`\nwrote ${edits.length} edits · div ${dv}/${dvc} · svg ${sv}/${svc} · span ${sp}/${spc}`);
