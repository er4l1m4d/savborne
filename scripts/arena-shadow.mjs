// Stream 1 preview: the arena ground shadows, three ways. Writes NOTHING to the handoff.
//   A  as shipped today  — soft rgba ellipse, rival's is detached 34px below its feet
//   B  same soft ellipse, geometry corrected
//   C  hard-edged pixel shadow on a 24x4 art grid at whole scales, geometry corrected
// Positions are computed from each sprite's box, never hand-typed, so the geometry is
// provably right rather than eyeballed.
import fs from 'node:fs';

const ARENA_BG = '#101A18';
const PAGE = '#0C1211';
const SHADOW_TONE = '#0C1211';   // an existing token, deliberately not a new colour

// ---- the pixel shadow: a 24x4 stepped oval, scaled in whole multiples only ----
const SHADOW_PATH = 'M6 0h12v1h-12zM2 1h20v1h-20zM2 2h20v1h-20zM6 3h12v1h-12z';
const shadowScale = (spriteW) => (spriteW <= 96 ? 3 : spriteW <= 112 ? 4 : 5);

// one fighter: sprite box + which shadow treatment to draw
function fighter(name, side, x, y, w, h, arenaH, treat, extra = '') {
  const feet = y + h;                                  // sprite base in arena coords
  const s = shadowScale(w);
  const sw = 24 * s, sh = 4 * s;
  const sx = x + (w - sw) / 2;
  const sy = feet - sh / 2;                            // centred on the base line
  const oldW = Math.round(w * 1.16), oldH = side === 'rival' ? 18 : 22;
  const oldX = x + (w - oldW) / 2, oldY = side === 'rival' ? 150 : arenaH - 28 - oldH;
  let shadow = '';
  if (treat === 'A' && side === 'rival') shadow = `<div style="position:absolute;left:${oldX}px;top:${oldY}px;width:${oldW}px;height:${oldH}px;border-radius:60px;background:rgba(0,0,0,0.4)"></div>`;
  else if (treat === 'A' || treat === 'B') shadow = `<div style="position:absolute;left:${side === 'rival' ? oldX : sx}px;top:${treat === 'A' ? oldY : sy}px;width:${treat === 'A' ? oldW : oldW}px;height:${oldH}px;border-radius:60px;background:rgba(0,0,0,0.4)"></div>`;
  else shadow = `<svg style="position:absolute;left:${sx}px;top:${sy}px;image-rendering:pixelated" width="${sw}" height="${sh}" viewBox="0 0 24 4" aria-hidden="true"><path fill="${SHADOW_TONE}" shape-rendering="crispEdges" d="${SHADOW_PATH}"></path></svg>`;
  const sprite = `<div role="img" aria-label="${name}" style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;${side === 'rival' ? 'transform:scaleX(-1);' : ''}${extra}"><svg class="spr" width="${w}" height="${h}" shape-rendering="crispEdges" viewBox="0 0 16 16">${SPRITES[side === 'rival' ? 'rival' : 'hero']}</svg></div>`;
  return { shadow, sprite, report: { name, treat, feet, shadowTop: treat === 'A' ? (side === 'rival' ? oldY : oldY) : Math.round(sy), gap: Math.round((treat === 'A' ? (side === 'rival' ? oldY : oldY) : sy) - (feet - sh / 2)) } };
}

// real sprite art, read from the shipped batch
const ART = JSON.parse(fs.readFileSync('assets/characters.json', 'utf8'));
const toSelfClosing = (p) => p.replace(/><\/path>/g, '/>');
const SPRITES = {
  hero: toSelfClosing(ART['Hero · Silver']),
  rival: toSelfClosing(ART['Rival · Mint Wraith']),
};

// ---- arena compositions, measured from the handoff ----
// The doc's arena is 390 - 2*22 = 346px wide. Fighters are anchored the way the real
// markup anchors them (player by left, rival by right), and every panel is shrunk with a
// CSS transform so the internal coordinates stay true instead of being rescaled by hand.
const ARENA_W = 346;
const byRight = (rightInset, w) => ARENA_W - rightInset - w;
const COMPS = [
  { id: 'A_Battle / A_InBattleWait', h: 410, fighters: [
      { name: 'rival 96x96, top:20 right:36', side: 'rival', x: byRight(36, 96), y: 20, w: 96, h: 96 },
      { name: 'player 112x112, bottom:40 left:30', side: 'hero', x: 30, y: 410 - 40 - 112, w: 112, h: 112 } ] },
  { id: 'A_Win / A_Loss', h: 250, fighters: [
      { name: 'winner 108, bottom:36 left:66', side: 'hero', x: 66, y: 250 - 36 - 108, w: 108, h: 108 },
      { name: 'loser 84, bottom:32 right:60, opacity .55', side: 'rival', x: byRight(60, 84), y: 250 - 32 - 84, w: 84, h: 84, extra: 'opacity:0.55;' } ] },
  { id: 'A_Tie', h: 250, fighters: [
      { name: 'left 108, bottom:36 left:66', side: 'hero', x: 66, y: 250 - 36 - 108, w: 108, h: 108 },
      { name: 'right 96, bottom:34 right:56', side: 'rival', x: byRight(56, 96), y: 250 - 34 - 96, w: 96, h: 96 } ] },
];
const K = 0.6;

const panel = (comp, treat, caption) => {
  const rows = comp.fighters.map((f) => fighter(f.name, f.side, f.x, f.y, f.w, f.h, comp.h, treat, f.extra || ''));
  return `<figure><figcaption><b>${caption}</b><span>${comp.id}</span></figcaption>
<div class="clip" style="width:${Math.round(ARENA_W * K)}px;height:${Math.round(comp.h * K)}px"><div class="arena" style="width:${ARENA_W}px;height:${comp.h}px;transform:scale(${K})">${rows.map((r) => r.shadow + r.sprite).join('')}</div></div></figure>`;
};

const TREATMENTS = [
  ['A', 'A · as shipped today', 'soft ellipse, rival detached'],
  ['B', 'B · geometry fixed', 'same soft ellipse, seated on the feet'],
  ['C', 'C · hard-edged pixel shadow', '24x4 art grid, whole scales only'],
];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Stream 1 — arena ground shadows</title><style>
body{background:${PAGE};color:#F3EEDD;font:600 13px system-ui;padding:22px;margin:0}
h1{font-size:19px}.lead{color:#A9B8B2;max-width:900px}
.row{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0 26px}
figure{margin:0}figcaption{margin-bottom:6px}figcaption b{display:block;font-size:13px}
figcaption span{color:#A9B8B2;font-size:11px;font-weight:500}
.clip{overflow:hidden;border:2px solid #C9C1A8;box-sizing:border-box}
.arena{position:relative;background:${ARENA_BG};transform-origin:0 0;box-sizing:border-box}
svg.spr{image-rendering:pixelated}
table{border-collapse:collapse;margin:14px 0;font-size:12px}td,th{border:1px solid #2E4642;padding:5px 9px;text-align:left}
th{background:#151F1D}
.flag{color:#F2735A;font-weight:800}.ok{color:#6FD0AE;font-weight:800}</style></head><body>
<h1>Stream 1 — the arena ground shadows (my items 2 and 10, one bug)</h1>
<p class="lead">Variant A is what is in the handoff right now: a blurred <code>rgba(0,0,0,0.4)</code> ellipse whose rival copy sits at <code>top:150px</code> while that sprite's feet are at <code>116px</code> — 34px of empty arena between them. That detached pill is the "dark film" and the "black bar"; they are the same element. B keeps the soft ellipse and seats it correctly. C replaces it with a hard-edged shadow drawn on a 24×4 art grid at whole-pixel scales, in <code>${SHADOW_TONE}</code> — an existing token, not a new colour.</p>
${COMPS.map((c) => `<div class="row">${TREATMENTS.map(([t, cap, sub]) => panel(c, t, `${cap} — ${sub}`)).join('')}</div>`).join('')}
<h1 style="margin-top:30px">Geometry, computed not eyeballed</h1>
<table><tr><th>composition</th><th>fighter</th><th>sprite feet (arena px)</th><th>A shadow top</th><th>A gap</th><th>C shadow top</th><th>C scale</th></tr>
${COMPS.map((c) => c.fighters.map((f) => {
  const feet = f.y + f.h, s = shadowScale(f.w), sh = 4 * s, top = Math.round(feet - sh / 2);
  const aTop = f.side === 'rival' ? 150 : c.h - 28 - (f.side === 'rival' ? 18 : 22);
  const gap = aTop - feet;
  return `<tr><td>${c.id}</td><td>${f.name}</td><td>${feet}</td><td>${aTop}</td><td class="${Math.abs(gap) > 14 ? 'flag' : 'ok'}">${gap > 0 ? '+' : ''}${gap}px ${Math.abs(gap) > 14 ? 'DETACHED' : 'ok'}</td><td>${top}</td><td>×${s} (${24 * s}×${sh})</td></tr>`;
}).join('')).join('')}
</table>
<p class="lead"><b>What I need from you on C:</b> whether <code>${SHADOW_TONE}</code> against the <code>${ARENA_BG}</code> arena is dark enough to read as a shadow. It is subtle by design, because the alternative is inventing a colour that exists nowhere in the token set — and a shadow is not worth a new token. If it is too faint, the honest options are a slightly larger shadow rather than a darker one, or accepting a new token deliberately.</p>
</body></html>`;
// ---- diagnostic: is the "dark film" actually the pack outline shell? ----
// Renders each sprite on the arena ground, then the same sprite with every #3F2631
// outline pixel recoloured to coral, so the share of the figure that IS outline is
// visible rather than arguable.
const OUTLINE = '#3F2631';
function outlineSplit(key) {
  const p = ART[key];
  let total = 0, dark = 0;
  for (const m of p.matchAll(/fill="([^"]+)"[^>]*d="([^"]*)"/g)) {
    const area = [...m[2].matchAll(/h(\d+)/g)].reduce((n, r) => n + Number(r[1]), 0);
    total += area;
    if (m[1] === OUTLINE) dark += area;
  }
  const highlighted = p.replace(new RegExp(`fill="${OUTLINE}"`, 'g'), 'fill="#F2735A"');
  return { total, dark, pct: Math.round((dark / total) * 100), highlighted };
}
const KEYS = ['Hero · Entry', 'Hero · Silver', 'Heroine · Entry', 'Rival · Mint Wraith'];
for (const k of KEYS) { const s = outlineSplit(k); console.log(`outline share  ${k.padEnd(20)} ${String(s.dark).padStart(3)}/${String(s.total).padStart(3)} px = ${s.pct}%`); }
const diag = KEYS.map((k) => {
  const s = outlineSplit(k);
  return `<div class="dg"><div><svg width="96" height="96" viewBox="0 0 16 16" style="image-rendering:pixelated">${toSelfClosing(ART[k])}</svg></div>
<div><svg width="96" height="96" viewBox="0 0 16 16" style="image-rendering:pixelated">${toSelfClosing(s.highlighted)}</svg></div>
<p><b>${k}</b><span>${s.dark} of ${s.total} painted px are outline — <em>${s.pct}%</em></span></p></div>`;
}).join('');

fs.writeFileSync('assets-raw/shadow-preview.html', html.replace('</body>', `
<h1 style="margin-top:34px">The other candidate for "dark film" — the outline shell</h1>
<p class="lead">Left: the sprite on the arena ground, as shipped. Right: the same sprite with every <code>${OUTLINE}</code> pixel recoloured coral, so you can see how much of the figure is outline rather than fill. If the film you noticed is this, the fix is nothing to do with shadows and everything to do with how much of a 16×16 pack tile is allowed to be near-black at 6×.</p>
<div class="diags">${diag}</div>
<style>.diags{display:flex;gap:22px;flex-wrap:wrap}.dg{display:flex;gap:10px;align-items:flex-end;background:${ARENA_BG};border:2px solid #2E4642;padding:12px;flex-direction:column}
.dg p{margin:0;font-size:11px;color:#A9B8B2}.dg p b{display:block;color:#F3EEDD;font-size:12px}.dg p em{color:#F2735A;font-weight:800}
.dg div{display:flex;gap:10px}</style>
</body>`));
console.log('preview: http://localhost:5511/assets-raw/shadow-preview.html');
console.log('nothing written to Savborne-handoff.html');
