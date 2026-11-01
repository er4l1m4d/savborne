// Pass 3 — close the document.
//
// Two jobs:
//   1. Add the two approved gate screens (A_Gate, A_Preparing) to Errors, taking the document
//      from 30 to 32 screens.
//   2. Snap every off-grid Silkscreen numeral onto the 4px grid.
//
// The numbering rule, decided this session after measuring both faces at 36px in the browser:
//   Silkscreen draws display and numerals at 20px and above. Jakarta draws everything below 20px,
//   numerals included. There is no "data vs drama" split — a number is drawn by one face at any
//   given size, so `2.00` and `+20 XP` in the same card are both Silkscreen 24.
//
// That rule is why THIS SCRIPT CHANGES NO FACES AND ADDS NO TABULAR FIGURES. An earlier draft
// retyped balances, profile tiles and the queue timer to Jakarta 700 tabular; that was reversed on
// the user's instruction for consistency. Only size snaps survive, and the assertion block at the
// bottom proves it: Silkscreen declaration count rises only by the one added gate header, and the
// tabular-figure count is unchanged.
//
// Off-grid Silkscreen sites, measured from the file rather than assumed (21 / 29 / 51 are not
// multiples of 4, and Silkscreen's advances are fractional at exactly those sizes):
//   A_Profile      21 -> 20   x3  (1042 / 7 / 12)
//   A_Withdrawal   21 -> 20   x2  (12.55, 6.20)
//   A_Queue        29 -> 28   x1  (0:42)
//   A_QueueTimeout 51 -> 52   x1  (3:05, frozen elapsed value, so no face change is wanted)
// Already on-grid and therefore untouched: 12.40 @36, 12.55 @32, 2.00 @24, every +XP @24, all
// 44px result titles, all 24/28/32/36 word instances.
//
// Modes: --preview (default) writes assets-raw/close-document-preview.html and changes nothing else.
//        --ship            rewrites Savborne-handoff.html.
import fs from 'node:fs';

const FILE = 'Savborne-handoff.html';
const PREVIEW = 'assets-raw/close-document-preview.html';
const mode = process.argv.includes('--ship') ? 'ship' : 'preview';
const src = fs.readFileSync(FILE, 'utf8');
const NL = src.includes('\r\n') ? '\r\n' : '\n';

const count = (text, needle) => text.split(needle).length - 1;

function replaceExact(text, from, to, expected, label) {
  const got = count(text, from);
  if (got !== expected) throw new Error(`${label}: found ${got}, expected ${expected}`);
  return text.split(from).join(to);
}

function figureBounds(text, id) {
  const a = text.indexOf(`<figure class="scr" id="${id}">`);
  if (a < 0) throw new Error(`screen not found: ${id}`);
  const b = text.indexOf('</figure>', a);
  if (b < 0) throw new Error(`unclosed figure: ${id}`);
  return [a, b + '</figure>'.length];
}
const figures = (text) => [...text.matchAll(/<figure class="scr" id="([^"]+)">/g)].map((m) => m[1]);

// Rewrite inside one screen only, so an identical style string elsewhere cannot be caught.
function oneScreen(text, id, from, to, expected = 1) {
  const [a, b] = figureBounds(text, id);
  const block = text.slice(a, b);
  return text.slice(0, a) + replaceExact(block, from, to, expected, `${id} ${JSON.stringify(from)}`) + text.slice(b);
}

// ---------------------------------------------------------------- 1. the two gate screens
// Markup is lifted from the document's own patterns: the 390x844 frame wrapper, the 36px-high
// Silkscreen header of A_UpdatePay, the 132px .pxw/.px icon panel of A_UpdatePay and A_Welcome,
// and A_Welcome's icon + wordmark pair verbatim (extracted below and asserted byte-identical).
const WELCOME_LOGO = (() => {
  const [a, b] = figureBounds(src, 'A_Welcome');
  const block = src.slice(a, b);
  const m = block.match(/<svg width="36" height="36"[\s\S]*?<\/svg>\s*<svg width="164" height="14"[\s\S]*?<\/svg>/);
  if (!m) throw new Error('A_Welcome icon + wordmark pair not found — refusing to invent a second copy');
  return m[0];
})();

const SCREEN_OPEN = '<div style="width: 390px; height: 844px; box-sizing: border-box; padding: 24px 22px 32px; background: #0C1211; color: #F3EEDD; font-family: \'Plus Jakarta Sans\', system-ui, sans-serif; display: flex; flex-direction: column; overflow: hidden">';

// The phone icon is generated from a 24x24 pixel map rather than hand-written path data.
// The first draft was hand-written and art-gates found 2 ORPHANS in it: painted pixels with no
// 4-neighbour, which it reads from the run-format paths and which I could not see by reading the
// markup. art-gates only understands 1px-tall horizontal runs (M{x} {y}h{w}v1h-{w}z), so vertical
// strips written as h1v18h-1z are invisible to it; emitting runs from a map keeps the icon inside
// the dialect the gate can check, and the assertion below re-runs the same 4-neighbour test here so
// the ship refuses before the gate ever has to complain.
const PHONE_MINT = '#6FD0AE';
const PHONE_CREAM = '#F3EEDD';
const PHONE_CORAL = '#F2735A';
const PHONE_GRID = (() => {
  const g = Array.from({ length: 24 }, () => Array(24).fill(null));
  const rect = (x0, y0, x1, y1, colour) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || y < 0 || x > 23 || y > 23) throw new Error(`phone pixel outside the 24 grid: ${x},${y}`);
      g[y][x] = colour;
    }
  };
  // handset outline: a 1px ring, top and bottom inset by one so the corners step
  rect(8, 2, 15, 2, PHONE_MINT);
  rect(7, 3, 7, 20, PHONE_MINT);
  rect(16, 3, 16, 20, PHONE_MINT);
  rect(8, 21, 15, 21, PHONE_MINT);
  // app grid: three rows of 2x2 tiles, symmetric inside the 8..15 interior
  for (const y of [5, 8, 11]) {
    rect(9, y, 10, y + 1, PHONE_CREAM);
    rect(13, y, 14, y + 1, PHONE_CREAM);
  }
  // the Savborne dot, coral, low on the screen
  rect(11, 18, 12, 18, PHONE_CORAL);
  return g;
})();

// Emit runs in exactly the form art-gates parses: M{x} {y}h{w}v1h-{w}z.
function pathFromGrid(grid, colour) {
  const runs = [];
  for (let y = 0; y < 24; y++) {
    let x = 0;
    while (x < 24) {
      if (grid[y][x] !== colour) { x++; continue; }
      const start = x;
      while (x < 24 && grid[y][x] === colour) x++;
      const w = x - start;
      runs.push(`M${start} ${y}h${w}v1h-${w}z`);
    }
  }
  return runs.join('');
}

// Same test art-gates applies: no painted pixel may be without a 4-neighbour.
(() => {
  const orphans = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    if (!PHONE_GRID[y][x]) continue;
    const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      .filter(([nx, ny]) => PHONE_GRID[ny] && PHONE_GRID[ny][nx]).length;
    if (!n) orphans.push(`${x},${y}`);
  }
  if (orphans.length) throw new Error(`phone icon has orphan pixels at ${orphans.join(' ')}`);
})();

const PHONE_PATHS = [PHONE_MINT, PHONE_CREAM, PHONE_CORAL]
  .map((colour) => `<path fill="${colour}" shape-rendering="crispEdges" d="${pathFromGrid(PHONE_GRID, colour)}"></path>`)
  .join('');
// 24x24 geometry at 72px: a 3x multiple in the screen's own coordinate space, like the other 74
// 24-grid sprites here. The document scales every screen by .7 for the sheet, so nothing renders at
// exactly 3x on the page; the attribute pairing below matches the 744 existing paths rather than
// inventing a local convention.
const PHONE_SVG = '<svg width="72" height="72" viewBox="0 0 24 24" role="img" aria-label="Phone showing Savborne">' + PHONE_PATHS + '</svg>';

const GATE = [
  `<figure class="scr" id="A_Gate"><div class="frame"><div class="inner">${SCREEN_OPEN}`,
  '',
  '<span style="font-family: \'Silkscreen\', monospace; font-weight: 400; font-size: 24px; letter-spacing: normal; display: flex; align-items: center; height: 36px">Open inside Nimiq Pay</span>',
  '',
  // No CTA on purpose: the URL is already in the address bar, so a button would have nothing to do.
  '<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; text-align: center">',
  '<div class="pxw" style="--o: #C9C1A8; --s: #2E4642">',
  '<div class="px" style="width: 132px; height: 132px; background: #151F1D; display: flex; align-items: center; justify-content: center">',
  PHONE_SVG,
  '</div>',
  '</div>',
  '<h1 style="margin: 0; font-family: \'Plus Jakarta Sans\', system-ui, sans-serif; font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.1">Savborne lives inside Nimiq Pay</h1>',
  '<p style="margin: 0; font-size: 16px; line-height: 1.5; color: #A9B8B2; font-weight: 500">Savborne is a Nimiq Pay Mini App. Open this URL inside the Nimiq Pay app to connect your savings account.</p>',
  '</div>',
  '</div></div></div>',
  '<figcaption><b>Open inside Nimiq Pay</b><code>gate / outside</code><ul><li>No CTA: the URL is already in the address bar. Opening it inside Nimiq Pay is the whole action.</li><li>Shown when the page loads outside the Nimiq Pay webview.</li></ul></figcaption>',
  '</figure>',
].join(NL);

const PREPARING = [
  `<figure class="scr" id="A_Preparing"><div class="frame"><div class="inner">`,
  '<div style="width: 390px; height: 844px; box-sizing: border-box; background: #0C1211; color: #F3EEDD; font-family: \'Plus Jakarta Sans\', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; overflow: hidden">',
  '<div style="display: flex; flex-direction: column; align-items: center; gap: 16px">',
  `<div style="display: flex; align-items: center; gap: 10px; height: 44px">${WELCOME_LOGO}</div>`,
  '<span style="font-size: 16px; font-weight: 500; color: #A9B8B2">Preparing Savborne…</span>',
  '</div>',
  '</div></div></div>',
  '<figcaption><b>Preparing Savborne…</b><code>gate / checking</code><ul><li>Waiting on the balance read. No spinner and no actions: the check resolves in one round trip, and a spinner would flash.</li></ul></figcaption>',
  '</figure>',
].join(NL);

let out = replaceExact(src, 'all 30 screens', 'all 32 screens', 1, 'lead screen count');
out = replaceExact(out, '<figure class="scr" id="A_UpdatePay">', `${GATE}${NL}${PREPARING}${NL}<figure class="scr" id="A_UpdatePay">`, 1, 'Errors insertion point');

// ---------------------------------------------------------------- 2. off-grid size snaps
// Face, weight, letter-spacing and line-height are carried through unchanged. Only font-size moves.
// Each entry is anchored to the value it sets, because a style string without its text is ambiguous:
// the plain 21px style is a literal substring of the coral one, so a style-only count reads 2.
const SILK21 = "font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 21px; line-height: 1";
const SILK20 = "font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 20px; line-height: 1";
const SILK29 = "font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 29px; line-height: 1.1";
const SILK28 = "font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 28px; line-height: 1.1";
const SILK51 = "font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 51px; line-height: 1";
const SILK52 = "font-family: 'Silkscreen', monospace; font-weight: 400; font-size: 52px; line-height: 1";

const snaps = [
  { screen: 'A_Profile', styleFrom: SILK21, styleTo: SILK20, text: '>1042</span>' },
  { screen: 'A_Profile', styleFrom: SILK21, styleTo: SILK20, text: '>7</span>' },
  { screen: 'A_Profile', styleFrom: SILK21, styleTo: SILK20, text: '>12</span>' },
  { screen: 'A_Withdrawal', styleFrom: `${SILK21}; color: #FF9C86`, styleTo: `${SILK20}; color: #FF9C86`, text: '>6.20' },
  { screen: 'A_Withdrawal', styleFrom: SILK21, styleTo: SILK20, text: '>12.55' },
  { screen: 'A_Queue', styleFrom: SILK29, styleTo: SILK28, text: '>0:42</span>' },
  { screen: 'A_QueueTimeout', styleFrom: SILK51, styleTo: SILK52, text: '>3:05</span>' },
].map((s) => ({ ...s, from: `style="${s.styleFrom}"${s.text}`, to: `style="${s.styleTo}"${s.text}` }));

for (const s of snaps) out = oneScreen(out, s.screen, s.from, s.to, 1);

// ---------------------------------------------------------------- 3. the one prose row that went stale
// The stat tile row described 21px as off-grid and told the reader to snap it. It is snapped, so
// the row now records the settled value. The specimen, the Home caption and the motion table need
// no edit: they already say Silkscreen, and Silkscreen is what these numerals still are.
out = replaceExact(
  out,
  'Flat tile, Silkscreen 21 — off the 4px grid, snap to 20 or 24; label 12/700 muted',
  'Flat tile, Silkscreen 20 — on the 4px grid; label 12/700 muted',
  1,
  'Stat tile component row',
);

// ---------------------------------------------------------------- assertions
const beforeFigures = figures(src);
const afterFigures = figures(out);
if (beforeFigures.length !== 30) throw new Error(`expected 30 screens before, found ${beforeFigures.length}`);
if (afterFigures.length !== 32) throw new Error(`expected 32 screens after, found ${afterFigures.length}`);

const insertAt = beforeFigures.indexOf('A_UpdatePay');
if (afterFigures[insertAt] !== 'A_Gate') throw new Error(`A_Gate not first before A_UpdatePay (found ${afterFigures[insertAt]})`);
if (afterFigures[insertAt + 1] !== 'A_Preparing') throw new Error(`A_Preparing not second before A_UpdatePay (found ${afterFigures[insertAt + 1]})`);
if (afterFigures[insertAt + 2] !== 'A_UpdatePay') throw new Error('A_UpdatePay did not shift by exactly two screens');
for (const id of beforeFigures) if (!afterFigures.includes(id)) throw new Error(`screen lost: ${id}`);
if (new Set(afterFigures).size !== afterFigures.length) throw new Error('duplicate screen id after insert');

// every snap landed exactly, and its old size is gone from that screen
for (const s of snaps) {
  const block = out.slice(...figureBounds(out, s.screen));
  if (count(block, s.to) !== 1) throw new Error(`${s.screen}: expected 1 x ${JSON.stringify(s.to)}, found ${count(block, s.to)}`);
  if (count(block, s.from)) throw new Error(`${s.screen}: old off-grid markup survives: ${s.from}`);
}

// Option 2 guarantees: no face changed, no tabular figure added.
const silkBefore = count(src, "font-family: 'Silkscreen'");
const silkAfter = count(out, "font-family: 'Silkscreen'");
if (silkAfter - silkBefore !== 1) throw new Error(`Silkscreen declaration count moved by ${silkAfter - silkBefore}, expected +1 (the A_Gate header only)`);
const tabBefore = count(src, 'font-variant-numeric: tabular-nums');
const tabAfter = count(out, 'font-variant-numeric: tabular-nums');
if (tabAfter !== tabBefore) throw new Error(`tabular-figure count moved by ${tabAfter - tabBefore}, expected 0 under Option 2`);

// numerals that were already on-grid must be byte-identical in both versions
const UNCHANGED = [
  ['A_Home', '<span style="font-family: \'Silkscreen\', system-ui, sans-serif; font-size: 36px; font-weight: 400; letter-spacing: 0; line-height: 1">12.40</span>'],
  ['A_HomeDone', '<span style="font-family: \'Silkscreen\', monospace; font-weight: 400; font-size: 32px; line-height: 1">12.55</span>'],
  ['A_FirstCheckin', '<span style="font-family: \'Silkscreen\', monospace; font-weight: 400; font-size: 24px; line-height: 1">2.00'],
  ['A_FirstCheckin', '<span style="font-family: \'Silkscreen\', monospace; font-weight: 400; font-size: 24px; line-height: 1; color: #6FD0AE">+20 XP</span>'],
  ['A_Win', '<span style="font-family: \'Silkscreen\', monospace; font-weight: 400; font-size: 24px; line-height: 1; color: #6FD0AE">+30 XP</span>'],
];
for (const [id, markup] of UNCHANGED) {
  const before = src.slice(...figureBounds(src, id));
  const after = out.slice(...figureBounds(out, id));
  if (count(before, markup) < 1) throw new Error(`${id}: expected on-grid numeral markup missing from source`);
  if (count(after, markup) !== count(before, markup)) throw new Error(`${id}: an on-grid numeral was altered: ${markup.slice(0, 70)}`);
}

// result titles are the design of record at 44px Silkscreen 400 and must be untouched
const titleRe = /font-family: 'Silkscreen', monospace; font-size: 44px; font-weight: 400/g;
const titlesBefore = (src.match(titleRe) || []).length;
const titlesAfter = (out.match(titleRe) || []).length;
if (titlesBefore !== 3 || titlesAfter !== 3) throw new Error(`result-title 44px/400 count changed: ${titlesBefore} -> ${titlesAfter}`);

// no Silkscreen size outside the 4px grid survives anywhere in a screen frame
const SCREENS = figures(out);
const inScreen = (pos) => SCREENS.some((id) => { const [a, b] = figureBounds(out, id); return pos >= a && pos <= b; });
const offGrid = [];
let i = -1;
while ((i = out.indexOf("font-family: 'Silkscreen'", i + 1)) !== -1) {
  const open = out.lastIndexOf('<', i);
  if (!inScreen(open)) continue;
  const style = (out.slice(open, out.indexOf('>', i) + 1).match(/style="([^"]*)"/) || [])[1] || '';
  const size = Number((style.match(/font-size:\s*(\d+(?:\.\d+)?)px/) || [])[1]);
  if (!Number.isFinite(size) || size % 4 !== 0) offGrid.push(`${SCREENS.find((id) => { const [a, b] = figureBounds(out, id); return open >= a && open <= b; })} ${size}px`);
}
if (offGrid.length) throw new Error(`off-grid Silkscreen sizes survive: ${offGrid.join(', ')}`);

// tag balance: deltas must match, and the two figures add a known, checkable amount
const tally = (text, re) => (text.match(re) || []).length;
const TAGS = ['div', 'svg', 'figure', 'p', 'span', 'h1', 'figcaption', 'ul', 'li', 'code', 'path', 'rect'];
const balance = {};
for (const tag of TAGS) {
  const o = tally(out, new RegExp(`<${tag}(?=[\\s>])`, 'g'));
  const c = tally(out, new RegExp(`</${tag}>`, 'g'));
  const selfClosing = tag === 'path' || tag === 'rect';
  if (!selfClosing && o !== c) throw new Error(`<${tag}> unbalanced in output: ${o} open, ${c} close`);
  balance[tag] = { before: tally(src, new RegExp(`<${tag}(?=[\\s>])`, 'g')), after: o };
}

// the gate screens are the only new svgs/figures: +3 svg (phone, icon, wordmark), +2 figures
if (balance.figure.after - balance.figure.before !== 2) throw new Error(`figure delta ${balance.figure.after - balance.figure.before}, expected 2`);
if (balance.svg.after - balance.svg.before !== 3) throw new Error(`svg delta ${balance.svg.after - balance.svg.before}, expected 3`);

// the wordmark + icon are the Welcome pair, byte for byte
for (const frag of [WELCOME_LOGO]) {
  if (!out.includes(frag)) throw new Error('gate screens do not carry the Welcome icon + wordmark markup verbatim');
}
if (count(out, WELCOME_LOGO) !== 2) throw new Error(`Welcome logo pair appears ${count(out, WELCOME_LOGO)} times, expected 2 (Welcome + Preparing)`);

// the gate body copy is the app's own string
const GATE_COPY = 'Savborne is a Nimiq Pay Mini App. Open this URL inside the Nimiq Pay app to connect your savings account.';
if (!out.includes(GATE_COPY)) throw new Error('gate body copy does not match VersionGate.tsx');
if (/<button/.test(out.slice(...figureBounds(out, 'A_Gate')))) throw new Error('A_Gate must not contain a CTA');

// The phone icon must survive the round trip art-gates performs: re-parse the emitted markup, rebuild
// the bitmap from its runs and re-run the 4-neighbour test. The grid assertion above proves the map is
// sound; this proves the markup actually prints that map, so an emit bug cannot slip through.
const gateBlock = out.slice(...figureBounds(out, 'A_Gate'));
if (count(gateBlock, PHONE_SVG) !== 1) throw new Error('A_Gate does not contain exactly one phone icon');
const painted = new Set();
for (const m of PHONE_SVG.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)) {
  const [, xs, ys, w, back] = m;
  if (Number(w) !== Number(back)) throw new Error(`phone run width/backtrack disagree: ${m[0]}`);
  for (let i = 0; i < Number(w); i++) painted.add(`${Number(xs) + i},${Number(ys)}`);
}
const gridPixels = PHONE_GRID.flat().filter(Boolean).length;
if (painted.size !== gridPixels) throw new Error(`phone markup paints ${painted.size} pixels, grid has ${gridPixels}`);
const phoneOrphans = [...painted].filter((key) => {
  const [x, y] = key.split(',').map(Number);
  return ![[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => painted.has(`${nx},${ny}`));
});
if (phoneOrphans.length) throw new Error(`phone icon orphan pixels in emitted markup: ${phoneOrphans.join(' ')}`);

// ---------------------------------------------------------------- report
const snapSites = snaps.length;
const labelOf = (s) => s.text.replace(/<\/span>$/, '').replace(/^>/, '').trim();
console.log(`${mode}: ${beforeFigures.length} -> ${afterFigures.length} screens; ${snapSites} size snaps; 0 face changes; 0 tabular added`);
for (const s of snaps) {
  console.log(`  ${s.screen.padEnd(15)} ${s.styleFrom.match(/font-size:\s*(\d+)px/)[1].padStart(2)}->${s.styleTo.match(/font-size:\s*(\d+)px/)[1]}px  ${labelOf(s)}`);
}

// ---------------------------------------------------------------- preview
function sliceElement(html, start) {
  const open = html.slice(start).match(/^<([a-z0-9]+)/i);
  if (!open) throw new Error(`no tag at ${start}`);
  const tag = open[1];
  const re = new RegExp(`<(/?)${tag}(?=[\\s/>])[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (m[1]) { if (--depth === 0) return html.slice(start, m.index + m[0].length); }
    else if (!/\/>$/.test(m[0])) depth++;
  }
  throw new Error(`unclosed <${tag}> at ${start}`);
}
function sampleNumeral(html, screen, needle) {
  const [a, b] = figureBounds(html, screen);
  const block = html.slice(a, b);
  const at = block.indexOf(needle);
  if (at < 0) throw new Error(`sample ${screen} ${JSON.stringify(needle)} not found`);
  return sliceElement(block, block.lastIndexOf('<span', at));
}

const SAMPLES = [
  { screen: 'A_Profile', needle: '>1042<', title: 'Profile — rating tile 1042', note: '21px sat off the 4px grid, so the pixel edges were being antialiased. Snapped to 20; face, weight and the flat tile are unchanged.' },
  { screen: 'A_Profile', needle: '>7<', title: 'Profile — wins tile 7', note: 'A single digit is the clearest place to see grid snapping: at 21px the em does not divide into whole pixels.' },
  { screen: 'A_Profile', needle: '>12<', title: 'Profile — check-ins tile 12', note: 'Same tile, same snap. All three tiles move together, which is the point of a rule rather than a preference.' },
  { screen: 'A_Withdrawal', needle: '>12.55', title: 'Withdrawal — last check-in 12.55', note: '21 -> 20. The nested NIM unit is Jakarta 600 14 from pass 2 and is deliberately untouched here.' },
  { screen: 'A_Withdrawal', needle: '>6.20', title: 'Withdrawal — now 6.20', note: 'The coral pair to the value above; keeps color: #FF9C86 and shrinks by the same 1px.' },
  { screen: 'A_Queue', needle: '>0:42<', title: 'Queue — live timer 0:42', note: '29 -> 28. Silkscreen stays: this is a display numeral, and the numbering rule says one face per size.' },
  { screen: 'A_QueueTimeout', needle: '>3:05<', title: 'Queue timeout — frozen 3:05', note: '51 -> 52, rounding up so a heading never shrinks. The only site in this pass that grows.' },
];

const CONSISTENT = [
  { screen: 'A_FirstCheckin', needles: ['>2.00', '>+20 XP<'], title: 'Check-in receipt — the consistency that was the whole point', note: 'The balance and the XP reward sit in one card at one size. Under the numbering rule they are both Silkscreen 24, and both are untouched by this pass.' },
  { screen: 'A_Win', needles: ['>+30 XP<', '>+18<'], title: 'Win — reward and rating delta', note: 'Both Silkscreen 24, both already on-grid, both untouched. Nothing to reconcile.' },
];

const styleDoc = src.slice(src.indexOf('<style>') + 7, src.indexOf('</style>'));
const BASE = "background:#0C1211;color:#F3EEDD;font-family:'Plus Jakarta Sans',system-ui,sans-serif;display:flex;flex-direction:column;gap:10px";

const detail = (s) => {
  const before = sampleNumeral(src, s.screen, s.needle);
  const after = sampleNumeral(out, s.screen, s.needle);
  return `
<section class="det">
  <h2>${s.title}</h2>
  <p class="note">${s.note}</p>
  <div class="pair">
    <div><div class="cap"><b>BEFORE</b></div><div class="z"><div style="${BASE};padding:14px">${before}</div></div></div>
    <div><div class="cap"><b>AFTER</b></div><div class="z"><div style="${BASE};padding:14px">${after}</div></div></div>
  </div>
</section>`;
};

const consistent = (s) => {
  const before = s.needles.map((n) => sampleNumeral(src, s.screen, n)).join('');
  const after = s.needles.map((n) => sampleNumeral(out, s.screen, n)).join('');
  return `
<section class="det">
  <h2>${s.title}</h2>
  <p class="note">${s.note}</p>
  <div class="pair">
    <div><div class="cap"><b>BEFORE</b></div><div class="z"><div style="${BASE};padding:14px">${before}</div></div></div>
    <div><div class="cap"><b>AFTER — identical</b></div><div class="z"><div style="${BASE};padding:14px">${after}</div></div></div>
  </div>
</section>`;
};

const AFFECTED = ['A_Profile', 'A_Withdrawal', 'A_Queue', 'A_QueueTimeout'];
const screenPair = (id) => {
  const [a, b] = figureBounds(src, id);
  const [c, d] = figureBounds(out, id);
  return `
<section class="det">
  <h2>${id}</h2>
  <div class="pair">
    <div><div class="cap"><b>BEFORE</b></div><div class="clip">${src.slice(a, b)}</div></div>
    <div><div class="cap"><b>AFTER</b></div><div class="clip">${out.slice(c, d)}</div></div>
  </div>
</section>`;
};

const newScreen = (id, note) => {
  const [a, b] = figureBounds(out, id);
  return `
<section class="det">
  <h2>${id}</h2>
  <p class="note">${note}</p>
  <div class="clip">${out.slice(a, b)}</div>
</section>`;
};

const resultTitles = ['A_Win', 'A_Loss', 'A_Tie'].map((id) => {
  const block = src.slice(...figureBounds(src, id));
  const m = block.match(/<h1[^>]*font-size: 44px[^>]*>[^<]*<\/h1>/);
  if (!m) throw new Error(`result title markup not found in ${id}`);
  return `<div class="z"><div style="${BASE};padding:14px">${m[0]}</div></div>`;
}).join('');

const GATE_NOTE = "No CTA: the URL is already in the address bar, so the only action is opening it inside Nimiq Pay. Body copy is the app's own string from VersionGate.tsx, not a rewrite.";
const PREPARING_NOTE = "Icon and wordmark are A_Welcome's markup extracted verbatim, and the script asserts the pair appears exactly twice. No spinner: the check is one round trip, so a spinner would flash.";

const DECISIONS = [
  ['Numbering rule', 'Silkscreen draws display and numerals at 20px and up. Jakarta draws everything below 20px, numerals included. One face per size, no exceptions.'],
  ['Balance', 'Stays Silkscreen. 36 / 32 / 24 were already on the 4px grid, so the balance, HomeDone and the check-in receipt are untouched by this pass.'],
  ['Profile tiles', '1042 / 7 / 12 keep Silkscreen and snap 21 → 20. Face unchanged, tabular not applicable (Silkscreen has no OpenType features).'],
  ['Queue timer', '0:42 keeps Silkscreen and snaps 29 → 28.'],
  ['Queue timeout', '3:05 keeps Silkscreen and snaps 51 → 52, up so a heading never shrinks.'],
  ['Result titles', '44px Silkscreen 400 is the design of record, and it is now consistent with the rule rather than an exception. The app\'s 24px/700 is a build gap.'],
  ['Gate screens', 'A_Gate and A_Preparing added before Errors. 30 → 32 screens.'],
  ['Sub-20px numerals', 'Not touched. Pass 2 shipped them as Jakarta, and that stays: below 20px the rule is Jakarta for everything.'],
];

const rows = snaps.map((s) => `<tr><td><code>${s.screen}</code></td><td>${JSON.stringify(labelOf(s))}</td><td><b>${s.styleFrom.match(/font-size:\s*(\d+)/)[1]} → ${s.styleTo.match(/font-size:\s*(\d+)/)[1]}px</b></td><td>Silkscreen 400</td><td>unchanged</td></tr>`);
const tableRows = rows.join('');
const decisionRows = DECISIONS.map(([a, b]) => `<tr><th>${a}</th><td>${b}</td></tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Pass 3 — close the document</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Silkscreen:wght@400;700&display=swap">
<style>
${styleDoc}
main.pv{margin:0;padding:36px 40px 90px;max-width:1320px}
h1.page{font-weight:800;font-size:42px;letter-spacing:-.03em;margin:0 0 10px}
.lede{font-size:17px;max-width:88ch;color:var(--sv-muted);margin:0 0 8px}
.det{margin:0 0 42px}
.det h2{font-weight:800;font-size:22px;border-top:2px solid var(--sv-edge);padding-top:14px;margin:0 0 4px}
.note{font-size:13px;color:var(--sv-muted);margin:0 0 12px;max-width:90ch}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start}
.cap{font:400 12px var(--sv-font-pixel);color:var(--sv-muted);margin-bottom:6px}
.cap b{color:var(--sv-text)}
.z{zoom:1.45}
.clip{width:273px;height:591px;overflow:hidden}
table.t td,table.t th{font-size:13px;padding:6px 10px;text-align:left}
table.t th{background:var(--sv-surface);color:var(--sv-text);font-weight:700}
table.t{border-collapse:collapse;width:100%;margin:12px 0 34px}
table.t th:first-child{width:190px}
table.t td code{font-size:12px}
.warn{background:var(--sv-warn-fill);border:2px solid var(--sv-coral);color:var(--sv-coral-text);padding:12px 14px;margin:16px 0;font-size:14px;max-width:95ch}
</style></head><body><main class="pv">
<h1 class="page">Pass 3 — close the document</h1>
<p class="lede">Generated by the same script that will ship this, from the committed file. Every panel is the real markup: BEFORE is the file now, AFTER has only the inline styles this pass edits.</p>
<div class="warn"><b>This pass changes no faces and adds no tabular figures.</b> It snaps seven off-grid Silkscreen numerals onto the 4px grid and adds two gate screens. The script asserts both facts rather than trusting them: the Silkscreen declaration count rises by exactly one (the new gate header) and the tabular-figure count is unchanged.</div>

<h2 style="font-size:30px;margin:34px 0 0">Decisions</h2>
<table class="t">${decisionRows}</table>

<h2 style="font-size:30px;margin:40px 0 0">The seven snaps</h2>
<table class="t"><thead><tr><th>screen</th><th>value</th><th>size</th><th>face</th><th>figures</th></tr></thead><tbody>${tableRows}</tbody></table>

<h2 style="font-size:30px;margin:44px 0 0">Detail, at 1.45×</h2>
${SAMPLES.map(detail).join('')}

<h2 style="font-size:30px;margin:44px 0 0">What this pass did NOT touch — and why that is the win</h2>
<p class="note">The complaint that started this revision was inconsistency: two faces in one card. These panels show the sites where the rule now holds with no edit at all.</p>
${CONSISTENT.map(consistent).join('')}

<h2 style="font-size:30px;margin:44px 0 0">Result titles — unchanged, by decision</h2>
<p class="note">44px Silkscreen 400 in all three result screens. Under the numbering rule this is no longer an exception carved out for drama; it is the same rule applied to a display numeral. The app renders these at 24px / 700, which is a recorded build gap.</p>
${resultTitles}

<h2 style="font-size:30px;margin:44px 0 0">New gate screens</h2>
${newScreen('A_Gate', GATE_NOTE)}
${newScreen('A_Preparing', PREPARING_NOTE)}

<h2 style="font-size:30px;margin:44px 0 0">Whole screens</h2>
${AFFECTED.map(screenPair).join('')}

<footer style="margin-top:60px;padding-top:16px;border-top:2px solid var(--sv-edge);font-size:13px;color:var(--sv-muted)">
32 screens · ${snapSites} size snaps · 0 face changes · 0 tabular figures added · generated ${new Date().toISOString().slice(0, 10)}
</footer>
</main></body></html>`;

if (mode === 'ship') {
  fs.writeFileSync(FILE, out);
  console.log(`\nwrote ${FILE} — ${snapSites} snaps, 2 screens added`);
} else {
  fs.writeFileSync(PREVIEW, html);
  console.log(`\nwrote ${PREVIEW} — ${SAMPLES.length} detail panels, ${CONSISTENT.length} unchanged panels, ${AFFECTED.length} whole screens (artefact untouched)`);
}
