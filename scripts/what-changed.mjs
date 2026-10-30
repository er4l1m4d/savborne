// A live before/after review page for everything this session changed.
//
// "Before" is NOT my memory — it is `git show HEAD:Savborne-handoff.html`, pulled through
// execSync as a buffer so PowerShell cannot mangle the encoding. "After" is the working
// file. Instances are paired by aria-label and classified by whether they changed, are
// new, or disappeared — so an empty BEFORE cell is labelled as what it actually is rather
// than left to look like a pairing failure.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const F = 'Savborne-handoff.html';
const before = execSync(`git show HEAD:${F}`, { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
const after = fs.readFileSync(F, 'utf8');
fs.writeFileSync('assets-raw/handoff-head.html', before);

const grab = (src) => {
  const m = new Map();
  for (const x of src.matchAll(/<svg\b[^>]*viewBox="0 0 (\d+) \1"[^>]*>[\s\S]*?<\/svg>/g)) {
    const label = (x[0].match(/aria-label="([^"]*)"/) || [, ''])[1];
    if (!label) continue;
    if (!m.has(label)) m.set(label, { grid: Number(x[1]), svg: x[0] });
  }
  return m;
};
const B = grab(before), A = grab(after);
const sized = (svg, px) => svg.replace(/\swidth="\d+"/, ` width="${px}"`).replace(/\sheight="\d+"/, ` height="${px}"`);

const labels = [...new Set([...B.keys(), ...A.keys()])];
const rows = labels.map((l) => {
  const b = B.get(l), a = A.get(l);
  let kind;
  if (b && a) kind = b.svg === a.svg ? 'same' : b.grid !== a.grid ? 'regrid' : 'redraw';
  else if (a) kind = 'new';
  else kind = 'removed';
  return { label: l, b, a, kind };
});

const isBadge = (l) => /badge/i.test(l);
const changed = rows.filter((r) => r.kind !== 'same' && r.kind !== 'removed');
const removed = rows.filter((r) => r.kind === 'removed');
const badgeRows = changed.filter((r) => isBadge(r.label));
const otherRows = changed.filter((r) => !isBadge(r.label));
const gridShift = rows.filter((r) => r.kind === 'regrid');

console.log(`before ${before.length} chars · after ${after.length} chars`);
console.log(`labelled svgs — before: ${B.size}, after: ${A.size}`);
console.log(`kinds: ${Object.entries(rows.reduce((a, r) => (a[r.kind] = (a[r.kind] || 0) + 1, a), {})).map(([k, v]) => `${k}=${v}`).join(', ')}`);
console.log(`badge rows: ${badgeRows.length}  other changed: ${otherRows.length}  removed: ${removed.length}`);

const KIND_LABEL = {
  regrid: 'grid changed',
  redraw: 'redrawn on the same grid',
  new: 'new — this asset did not exist in HEAD',
};
const cell = (side, rec, px) => {
  if (!rec) return `<div class="cell empty"><div class="art">—</div><span>${side} · absent in HEAD</span></div>`;
  return `<div class="cell"><div class="art">${sized(rec.svg, px)}</div><span>${side} · ${rec.grid}×${rec.grid} art</span></div>`;
};
const table = (list) => `<table><tr><th class="lab">asset</th><th>BEFORE — git HEAD</th><th>AFTER — working file</th><th class="k">what happened</th></tr>
${list.map((r) => {
  const px = Math.max(r.a?.grid || 0, r.b?.grid || 0) * 3;
  return `<tr><td class="lab">${r.label}</td><td>${cell('before', r.b, px)}</td><td>${cell('after', r.a, px)}</td><td class="k">${KIND_LABEL[r.kind] || r.kind}</td></tr>`;
}).join('')}</table>`;

// a real arena before/after, not colour chips: the same two sprites on each surface,
// so the contour claim can be seen rather than taken on trust
const CH = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const hero = CH['Hero · Silver'], rival = CH['Rival · Mint Wraith'];
const SURFACES = [
  { hex: '#101A18', tag: 'HEAD', sub: 'contour 1.30:1' },
  { hex: '#763B36', tag: 'shipped, then reversed', sub: 'contour 1.60:1' },
  { hex: '#0C1211', tag: 'working file', sub: 'contour 1.38:1' },
];
const svgOf = (art) => `<svg width="100%" height="100%" viewBox="0 0 16 16" shape-rendering="crispEdges" style="image-rendering:pixelated">${art}</svg>`;
const arenaRow = SURFACES.map((s) => {
  const inner = (art, x, y, w, flip) => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${w}px">${flip ? `<div style="transform:scaleX(-1);width:100%;height:100%">${svgOf(art)}</div>` : svgOf(art)}</div>`;
  return `<div><div class="arena" style="background:${s.hex}">${inner(rival, 148, 16, 74, true)}${inner(hero, 22, 76, 92, false)}<span class="alab">${s.tag}<br>${s.sub}</span></div></div>`;
}).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Savborne — what changed</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px 'Plus Jakarta Sans',system-ui,sans-serif;padding:24px;margin:0;max-width:1180px}
h1{font-size:22px;margin:0 0 6px}h2{font-size:15px;margin:34px 0 4px;color:#FEE761}
.note{color:#A9B8B2;font-weight:500;font-size:12px;max-width:940px;margin:0 0 12px}
table{border-collapse:collapse;width:100%}
th{text-align:left;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#A9B8B2;border-bottom:2px solid #2E4642;padding:6px 8px}
td{border-bottom:1px solid #1B2624;padding:10px 8px;vertical-align:middle}
td.lab{width:200px;font-size:12px}td.k{width:190px;font-size:11px;color:#A9B8B2;font-weight:500}
.cell{display:flex;flex-direction:column;align-items:center;gap:6px}
.cell .art{background:#151F1D;border:2px solid #2E4642;padding:10px;display:flex;align-items:center;justify-content:center;min-width:100px;min-height:100px;box-sizing:border-box}
.cell span{font-size:9px;color:#A9B8B2;font-weight:500}
.cell.empty .art{color:#4B5A56;font-size:22px}
svg{image-rendering:pixelated;display:block}
.arenas{display:flex;gap:14px;margin-top:10px;flex-wrap:wrap}
.arena{position:relative;width:250px;height:190px;border:2px solid #C9C1A8;box-shadow:0 3px 0 #2E4642;overflow:hidden}
.alab{position:absolute;left:8px;bottom:6px;font-size:10px;font-weight:700;color:#F3EEDD;background:rgba(12,18,17,.8);padding:3px 6px;line-height:1.5}
.sum{background:#151F1D;border:2px solid #2E4642;padding:14px;margin-top:26px;font-weight:500;font-size:12px;line-height:1.8}
.sum b{color:#6FD0AE}
code{font-family:ui-monospace,monospace;font-size:11px;color:#FEE761}
a{color:#6FD0AE}
</style></head><body>
<h1>What changed, live</h1>
<p class="note"><b>Before</b> is <code>git show HEAD:Savborne-handoff.html</code> — the last committed state, before any of this session's art work. <b>After</b> is the working file. Both sides are read out of real files and paired by <code>aria-label</code>; assets whose markup is byte-identical on both sides are dropped entirely, so nothing here is a no-op row.</p>
<p class="note"><b>Read "absent in HEAD" as a finding, not a bug.</b> The old badge set drew each badge in <em>one</em> state only — 7 badge instances existed. The new set is one drawing per badge rendered in three states, so 18 combinations exist now and 11 of them genuinely never did before. That asymmetry <em>is</em> the change.</p>

<h2>Badges — 8×8 hand-drawn → 24×24 sourced</h2>
<p class="note">Every old badge was a single flat colour with no rim and no ribbon; three sat at 2.32:1 against the card and one used <code>#E8C14A</code>, a UI token that fails pack palette. States are now one drawing plus a ramp swap plus a corner chip.</p>
${table(badgeRows)}

<h2>Glyphs and chrome — 12×12 and 8×8 → 24×24</h2>
<p class="note">Hand-drawn 12×12 glyphs and the last two 8×8 marks were replaced by pixelarticons at their native grid.</p>
${table(otherRows)}

<h2>Arena surface — reversed twice in one day</h2>
<p class="note">Same two sprites, three surfaces, so the contour difference can be seen rather than taken on trust. A <code>#763B36</code> floor with a lit horizon was built, shipped and verified, then reversed; the arena is now a flat panel filled with the page ground.</p>
<div class="arenas">${arenaRow}</div>

<div class="sum">
<b>Grids.</b> HEAD carried <code>8×8</code> and <code>12×12</code> art. Both are now <b>zero instances</b> — ${gridShift.length} labelled assets moved grid. Everything sits on two: <b>16×16</b> game art, <b>24×24</b> chrome and badges.<br>
<b>Arena panels.</b> <code>#101A18</code> appears ${(before.match(/background: #101A18/g) || []).length}× in HEAD and ${(after.match(/background: #101A18/g) || []).length}× now — only the 7 arenas were recoloured; the rest are unrelated panels, deliberately untouched.<br>
<b>Gates.</b> <code>art-gates.mjs</code> on HEAD: <b>161 assets, 78 FAIL</b>. On the working file: <b>190 assets, 0 FAIL</b>.<br>
<b>A defect found on the way.</b> Four glyphs had already shipped with pixels eaten out of them by a wrong fill rule — palette, orphan and contrast gates all stayed green on them. Repaired, and <code>scripts/glyph-provenance.mjs</code> now fails on any drift.<br>
<b>Labels that no longer appear (${removed.length}):</b> ${removed.map((r) => `<code>${r.label}</code>`).join(', ')} — these are renames, not lost art. The Golden Crown badge card moved to the state-suffixed label convention; the other was renamed earlier in the session.<br>
<b>Open the real thing:</b> <a href="/Savborne-handoff.html">Savborne-handoff.html</a> · <a href="/assets-raw/turn-states.html">Stream 2 turn states</a> · <a href="/assets-raw/badges-before.html">badges as they were</a> · <a href="/assets-raw/badges-new.html">the rejected hand-drawn set</a> · <a href="/assets-raw/glyph-diff.html">glyph fill-rule diff</a>
</div>
</body></html>`;
fs.writeFileSync('assets-raw/what-changed.html', html);
console.log('\npage: http://127.0.0.1:5512/assets-raw/what-changed.html');
