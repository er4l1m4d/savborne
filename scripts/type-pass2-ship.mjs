// Pass 2 of the type rule: every Silkscreen instance below 20px becomes Jakarta.
//
// 47 sites, found two ways:
//   44 declarations carrying `font-family: 'Silkscreen'` with a size under 20px, inside a screen frame;
//   +3 spans that declare only a size and INHERIT Silkscreen from the big number they sit inside
//      (the NIM units on A_FirstCheckin and A_Withdrawal). Those are listed explicitly, because no
//      amount of scanning a style attribute finds a face that isn't written down.
//
// The mapping is a role, not a size:
//   figure        text contains a digit      -> 700 + tabular-nums (a column that must not jitter)
//   unit          the sole text is "NIM"     -> 600, no tabular (a qualifier, not a value)
//   chip label    "Silver"                   -> 700
//   section label ALL-CAPS, 4+ chars         -> 700 + 0.1em tracking (the app's tracking-widest)
//
// Sizes are kept, with one exception: the 10px streak chip becomes 12px. 10px was legible because a
// pixel font is square at any size; Jakarta at 10px is the smallest text in the product, and the app
// already ships that chip at text-xs (12px).
//
// Tabular figures are declared inline rather than through a class. The artefact has no `.num`
// utility, and an inline `font-family` beats a class rule — a class-based fix here would look right
// in the source and silently do nothing in the browser. `globals.css` owns `.num`; the handoff can
// only show the measurement, and pass 2 records that the app renders these through `.num`.
//
// Modes: --preview (default) writes assets-raw/type-pass2-preview.html and changes nothing else.
//        --ship            rewrites Savborne-handoff.html.
import fs from 'node:fs';

const FILE = 'Savborne-handoff.html';
const PREVIEW = 'assets-raw/type-pass2-preview.html';
const mode = process.argv.includes('--ship') ? 'ship' : 'preview';

const src = fs.readFileSync(FILE, 'utf8');

// ---------------------------------------------------------------- screens
function figureBounds(text, id) {
  const a = text.indexOf(`<figure class="scr" id="${id}">`);
  if (a < 0) throw new Error(`screen not found: ${id}`);
  const b = text.indexOf('</figure>', a);
  if (b < 0) throw new Error(`unclosed figure: ${id}`);
  return [a, b];
}
const SCREENS = [...src.matchAll(/<figure class="scr" id="([^"]+)">/g)].map((m) => m[1]);
const screenAt = (text, pos) => SCREENS.find((id) => {
  const [a, b] = figureBounds(text, id);
  return pos >= a && pos <= b;
});

// ---------------------------------------------------------------- classification
const ownTextOf = (html, tagEnd) => html.slice(tagEnd + 1).split('<')[0].replace(/\s+/g, ' ').trim();
const isSectionLabel = (t) => /^[A-Z][A-Z ]{3,}$/.test(t);
const hasDigit = (t) => /\d/.test(t);

function classify(screen, text, size) {
  if (isSectionLabel(text)) return 'section label';
  if (text === 'NIM') return 'unit';
  if (hasDigit(text)) return 'figure';
  return 'chip label';
}

const WEIGHT = { figure: 700, unit: 600, 'chip label': 700, 'section label': 700 };

// The one size change, and why it is safe: a 28px-high pill whose width is auto.
const SIZE_CHANGE = { 'A_Home|1-week streak': [10, 12] };

// ---------------------------------------------------------------- the 44 declarations
function findDeclarations(html) {
  const out = [];
  let i = -1;
  while ((i = html.indexOf("font-family: 'Silkscreen'", i + 1)) !== -1) {
    const open = html.lastIndexOf('<', i);
    const tagEnd = html.indexOf('>', i);
    if (open < 0 || tagEnd < 0) continue;
    const screen = screenAt(html, open);
    if (!screen) continue; // document chrome, not a screen frame
    const tag = html.slice(open, tagEnd + 1);
    const style = (tag.match(/style="([^"]*)"/) || [])[1];
    if (style === undefined) continue;
    const size = Number((style.match(/font-size:\s*(\d+)px/) || [])[1]);
    if (!Number.isFinite(size) || size >= 20) continue;
    out.push({ screen, open, tagEnd, tagName: (tag.match(/^<([a-z0-9]+)/) || [])[1], tag, style, size, text: ownTextOf(html, tagEnd) });
  }
  return out;
}

// The 3 inherited units. Exact markup, exact count, and the parent must actually be Silkscreen —
// otherwise the diagnosis (inheritance) is wrong and the entry would "fix" a face that was never there.
const INHERITED = [
  { screen: 'A_FirstCheckin', open: '<span style="font-size: 14px; color: #A9B8B2; margin-left: 4px">', text: 'NIM', count: 1 },
  { screen: 'A_Withdrawal', open: '<span style="font-size: 14px; color: #A9B8B2">', text: 'NIM', count: 2 },
];

function findInherited(html) {
  const out = [];
  for (const spec of INHERITED) {
    const [a, b] = figureBounds(html, spec.screen);
    const block = html.slice(a, b);
    let from = 0;
    let n = 0;
    for (;;) {
      const rel = block.indexOf(spec.open, from);
      if (rel < 0) break;
      const tagEnd = block.indexOf('>', rel + spec.open.length - 1);
      const text = block.slice(tagEnd + 1, block.indexOf('</span>', tagEnd)).trim();
      if (text !== spec.text) throw new Error(`inherited unit at ${spec.screen} reads "${text}", expected "${spec.text}"`);
      const parent = block.slice(Math.max(0, rel - 260), rel);
      if (!parent.includes("font-family: 'Silkscreen'")) throw new Error(`inherited unit at ${spec.screen} has no Silkscreen parent — not a sub-20px Silkscreen site`);
      out.push({ screen: spec.screen, open: a + rel, tagEnd: a + tagEnd, tagName: 'span', tag: block.slice(rel, tagEnd + 1), style: spec.open.match(/style="([^"]*)"/)[1], size: Number((spec.open.match(/font-size:\s*(\d+)px/) || [])[1]), text, inherited: true });
      from = rel + spec.open.length;
      n++;
    }
    if (n !== spec.count) throw new Error(`${spec.screen}: found ${n} inherited units, expected ${spec.count}`);
  }
  return out;
}

// ---------------------------------------------------------------- the transform
function normalise(style) {
  return style.split(';').map((d) => d.trim()).filter(Boolean).join('; ');
}

function retype(site) {
  const role = classify(site.screen, site.text, site.size);
  const weight = WEIGHT[role];
  const [from, to] = SIZE_CHANGE[`${site.screen}|${site.text}`] ?? [site.size, site.size];

  const decls = normalise(site.style).split('; ');
  // family: Silkscreen -> Jakarta. The inherited units declare no family at all, so one is added.
  // A site that DOES declare a family and it isn't Silkscreen means this list is stale — refuse.
  let familyDone = false;
  let kept = decls.map((d) => {
    if (!/^font-family:/.test(d)) return d;
    if (!/Silkscreen/.test(d)) throw new Error(`${site.screen} "${site.text}": refusing to retype ${d}`);
    familyDone = true;
    return "font-family: 'Plus Jakarta Sans', system-ui, sans-serif";
  });
  if (!familyDone) {
    if (!site.inherited) throw new Error(`${site.screen} "${site.text}": declares no family and is not in the inherited list`);
    kept = ["font-family: 'Plus Jakarta Sans', system-ui, sans-serif", ...kept];
  }

  let out = kept;
  // weight: replace or add
  const wIdx = out.findIndex((d) => /^font-weight:/.test(d));
  if (wIdx >= 0) out[wIdx] = `font-weight: ${weight}`;
  else out.push(`font-weight: ${weight}`);

  // size
  if (from !== to) {
    const sIdx = out.findIndex((d) => /^font-size:/.test(d));
    if (sIdx < 0) throw new Error(`${site.screen} "${site.text}": no font-size to change`);
    out[sIdx] = `font-size: ${to}px`;
  }

  // figure: tabular figures, the only thing in this system that holds a digit column still
  if (role === 'figure') out.push("font-variant-numeric: tabular-nums", "font-feature-settings: 'tnum' 1");
  if (role === 'section label') out.push('letter-spacing: 0.1em');

  const newStyle = out.join('; ');
  if (newStyle === site.style) throw new Error(`${site.screen} "${site.text}": no change produced`);
  return { role, weight, from, to, newStyle };
}

// ---------------------------------------------------------------- build the edit list
const sites = [...findDeclarations(src), ...findInherited(src)];
if (sites.length !== 47) throw new Error(`expected 47 sites, found ${sites.length}`);

const report = sites.map((site) => {
  const t = retype(site);
  const newTag = site.tag.replace(`style="${site.style}"`, `style="${t.newStyle}"`);
  if (newTag === site.tag) throw new Error(`${site.screen} "${site.text}": tag unchanged`);
  return { ...site, ...t, newTag, role: t.role };
});

// tallies the ship must produce
const tally = (fn) => report.reduce((acc, r) => ((acc[fn(r)] = (acc[fn(r)] ?? 0) + 1), acc), {});
const roles = tally((r) => r.role);
const EXPECTED = { figure: 39, 'section label': 3, unit: 4, 'chip label': 1 };
for (const [k, v] of Object.entries(EXPECTED)) if (roles[k] !== v) throw new Error(`role ${k}: ${roles[k]}, expected ${v}`);
const numeric = report.filter((r) => r.role === 'figure').length;
if (numeric !== report.filter((r) => hasDigit(r.text)).length) throw new Error('tabular count does not match digit-bearing sites');

// ---------------------------------------------------------------- edit application
const edits = [...report].sort((a, b) => a.open - b.open);
for (let i = 1; i < edits.length; i++) if (edits[i].open < edits[i - 1].tagEnd) throw new Error('overlapping edits — refusing to write');

const countTags = (s, tag) => ({
  open: (s.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length,
  close: (s.match(new RegExp(`</${tag}>`, 'g')) || []).length,
});
const TAGS = ['div', 'span', 'svg', 'figure', 'p', 'button', 'h1'];
const balanceBefore = Object.fromEntries(TAGS.map((t) => [t, countTags(src, t)]));

function apply(html) {
  let out = html;
  for (const e of [...report].sort((x, y) => y.open - x.open)) {
    out = out.slice(0, e.open) + e.newTag + out.slice(e.tagEnd + 1);
  }
  return out;
}
const out = apply(src);

for (const t of TAGS) {
  const b = balanceBefore[t];
  const a = countTags(out, t);
  if (a.open !== b.open || a.close !== b.close) throw new Error(`tag balance changed for <${t}>: ${JSON.stringify(b)} -> ${JSON.stringify(a)}`);
}

// post-condition 1: nothing Silkscreen under 20px survives in a screen frame
const leftovers = findDeclarations(out);
if (leftovers.length) throw new Error(`still Silkscreen below 20px after edit: ${leftovers.map((l) => `${l.screen} "${l.text}" ${l.size}px`).join(', ')}`);

// post-condition 2: every rewritten tag is present in the output
const missing = report.filter((r) => !out.includes(r.newTag));
if (missing.length) throw new Error(`rewritten tag missing from output: ${missing.map((m) => `${m.screen} "${m.text}"`).join(', ')}`);

// post-condition 4: the inherited units are GONE. The declaration scan above cannot see them —
// they never declared Silkscreen, which is precisely how they survived an earlier pass unnoticed.
for (const spec of INHERITED) {
  const [, b] = figureBounds(out, spec.screen);
  const block = out.slice(figureBounds(out, spec.screen)[0], b);
  const leftover = block.split(spec.open).length - 1;
  if (leftover) throw new Error(`${spec.screen}: ${leftover} inherited span(s) still carry the old markup`);
}

// post-condition 3: the features actually landed. Counted as a DELTA against the source — the file
// already carries ~122 other `font-weight: 600` declarations, so a global count proves nothing.
const count = (s, re) => (s.match(re) || []).length;
const delta = (re) => count(out, re) - count(src, re);
const checks = [
  ['tabular-nums', /font-variant-numeric: tabular-nums/g, numeric],
  ['0.1em tracking', /letter-spacing: 0\.1em/g, 3],
  ['font-weight: 600', /font-weight: 600/g, 4],
  ['font-weight: 700', /font-weight: 700/g, 43],
  ['Silkscreen family', /font-family: 'Silkscreen'/g, -44],
];
for (const [name, re, want] of checks) {
  const got = delta(re);
  if (got !== want) throw new Error(`${name}: delta ${got}, expected ${want}`);
}

// ---------------------------------------------------------------- report
console.log(`${mode}: ${report.length} sites — ${Object.entries(roles).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
for (const r of report) {
  const size = r.from === r.to ? `${String(r.from).padStart(2)}px   ` : `${String(r.from).padStart(2)}->${String(r.to)}px`;
  console.log(`  ${r.screen.padEnd(15)} ${size} w${r.weight}${r.role === 'figure' ? ' +tnum' : ''} ${r.role === 'section label' ? '+track' : ''}  ${r.role.padEnd(13)} ${JSON.stringify(r.text)}`);
}

// ---------------------------------------------------------------- preview
function sliceElement(html, start) {
  const open = html.slice(start).match(/^<([a-z0-9]+)/i);
  if (!open) throw new Error(`no tag at ${start}`);
  const tag = open[1];
  const re = new RegExp(`<(/?)${tag}(?=[\\s/>])[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) return html.slice(start, m.index + m[0].length);
    } else if (!/\/>$/.test(m[0])) depth++;
  }
  throw new Error(`unclosed <${tag}> at ${start}`);
}

function sample(html, spec) {
  const [a] = figureBounds(html, spec.screen);
  const block = html.slice(a, figureBounds(html, spec.screen)[1]);
  if (spec.rows) {
    const re = /<div style="display: flex; align-items: center; gap: 12px; height: 56px/g;
    const starts = [...block.matchAll(re)].map((m) => m.index).slice(0, spec.rows);
    if (!starts.length) throw new Error(`${spec.id}: no rows`);
    const rows = starts.map((s) => sliceElement(block, s));
    return `<div style="background: #151F1D; padding: 2px 14px; display: flex; flex-direction: column">${rows.join('')}</div>`;
  }
  const at = block.indexOf(spec.needle);
  if (at < 0) throw new Error(`${spec.id}: "${spec.needle}" not found in ${spec.screen}`);
  const start = block.lastIndexOf(spec.open, at);
  if (start < 0) throw new Error(`${spec.id}: container "${spec.open.slice(0, 40)}" not found before "${spec.needle}"`);
  return sliceElement(block, start);
}

const SAMPLES = [
  { id: 'rows', screen: 'A_RanksRanked', rows: 3, title: 'Leaderboard rows — rank · name · bracket · Lv · rating', note: 'The three columns the rule names as changing numbers, all in one 346px row.' },
  { id: 'chips', screen: 'A_Home', open: '<div style="display: flex; align-items: center; gap: 8px">', needle: '>Silver<', title: 'Home — bracket and level chips', note: 'Both are 12px pills; "Lv 7" carries a figure, "Silver" does not.' },
  { id: 'balance', screen: 'A_Home', open: '<div style="display: flex; align-items: baseline; gap: 8px">', needle: '12.40', title: 'Home — balance line: 36px figure, unit, streak chip', note: 'The 36px figure stays Silkscreen (it is display). Its two neighbours do not.' },
  { id: 'xp', screen: 'A_Home', open: '<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px">', needle: '62 XP to Level 8', title: 'Home — character column: level line, XP bar, XP remaining', note: 'Shows the weight relationship to the 14px/600 level line above it.' },
  { id: 'xprows', screen: 'A_Home', open: '<div class="px" style="background: #151F1D; padding: 4px 18px; display: flex; flex-direction: column">', needle: '+10 XP', title: 'Home — mission reward figures', note: '12px rewards against 15px/600 mission names.' },
  { id: 'settings', screen: 'A_Settings', open: '<div style="display: flex; flex-direction: column; gap: 8px">', needle: 'ACCOUNT', title: 'Settings — uppercase section label + first row', note: 'The only site where the app convention adds tracking, not just a face.' },
  { id: 'friend', screen: 'A_FriendWait', open: '<div class="px" style="background: #151F1D; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between">', needle: '23h 58m left', title: 'Friend wait — live countdown beside a 700 label', note: 'Re-flows every minute: the case the rule exists for.' },
  { id: 'limit', screen: 'A_DailyLimit', open: '<div style="display: flex; align-items: baseline; justify-content: space-between">', needle: '14h 52m', title: 'Daily limit — 19px countdown', note: 'Prominent on purpose; size is kept, so the only change is face and figures.' },
  { id: 'checkin', screen: 'A_FirstCheckin', open: '<div style="background: #151F1D; border: 2px solid #C9C1A8; box-shadow: 0 3px 0 #2E4642; padding: 14px; display: flex; flex-direction: column; gap: 4px">', needle: '2.00', title: 'Check-in receipt — balance and its inherited unit', note: 'The NIM span writes no family at all; it renders Silkscreen only because its parent does.' },
  { id: 'withdrawal', screen: 'A_Withdrawal', open: '<div class="px" style="background: #151F1D; padding: 18px; display: flex; align-items: center; justify-content: space-between">', needle: '12.55', title: 'Withdrawal — two inherited units', note: 'Same inheritance, twice, in a before → after pair of balances.' },
];

const doc = fs.readFileSync(FILE, 'utf8');
const style = doc.slice(doc.indexOf('<style>') + 7, doc.indexOf('</style>'));
const BASE = "background: #0C1211; color: #F3EEDD; font-family: 'Plus Jakarta Sans', system-ui, sans-serif";

const detail = (s) => {
  const before = sample(src, s);
  const after = sample(out, s);
  return `
<section class="det">
  <h2>${s.title}</h2>
  <p class="note">${s.note}</p>
  <div class="pair">
    <div><div class="cap"><b>BEFORE</b></div><div class="z"><div style="${BASE}; padding: 14px">${before}</div></div></div>
    <div><div class="cap"><b>AFTER</b></div><div class="z"><div style="${BASE}; padding: 14px">${after}</div></div></div>
  </div>
</section>`;
};

const AFFECTED = ['A_Home', 'A_RanksRanked', 'A_RanksUnranked', 'A_Settings', 'A_FriendWait', 'A_DailyLimit', 'A_FirstCheckin', 'A_Withdrawal'];
const screenPair = (id) => {
  const [a, b] = figureBounds(src, id);
  const [c, d] = figureBounds(out, id);
  return `
<section class="det">
  <h2>${id}</h2>
  <div class="pair">
    <div><div class="cap"><b>BEFORE</b></div><div class="clip">${src.slice(a, b + 9)}</div></div>
    <div><div class="cap"><b>AFTER</b></div><div class="clip">${out.slice(c, d + 9)}</div></div>
  </div>
</section>`;
};

const rows = report.map((r) => `<tr>
  <td><code>${r.screen}</code></td>
  <td>${JSON.stringify(r.text)}</td>
  <td>${r.from === r.to ? `${r.from}px` : `<b>${r.from} → ${r.to}px</b>`}</td>
  <td>${r.role}</td>
  <td>${r.weight}</td>
  <td>${r.role === 'figure' ? 'tabular' : '—'}</td>
</tr>`).join('');

const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Pass 2 — sub-20px Silkscreen → Jakarta</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Silkscreen:wght@400;700&display=swap">
<style>
${style}
main.pv{margin:0;padding:36px 40px 90px;max-width:1320px}
h1.page{font-weight:800;font-size:42px;letter-spacing:-.03em;margin:0 0 10px}
.lede{font-size:17px;max-width:86ch;color:var(--sv-muted);margin:0 0 8px}
.det{margin:0 0 42px}
.det h2{font-weight:800;font-size:22px;border-top:2px solid var(--sv-edge);padding-top:14px;margin:0 0 4px}
.note{font-size:13px;color:var(--sv-muted);margin:0 0 12px;max-width:90ch}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:26px;align-items:start}
.cap{font:400 12px var(--sv-font-pixel);color:var(--sv-muted);margin-bottom:6px}
.cap b{color:var(--sv-text)}
.z{zoom:1.45}
.clip{width:273px;height:591px;overflow:hidden}
table.t td,table.t th{font-size:13px;padding:6px 10px}
table.t th{position:sticky;top:0;background:var(--sv-ground);z-index:2}
table.t td code{font-size:12px}
.warn{background:var(--sv-warn-fill);border:2px solid var(--sv-coral);color:var(--sv-coral-text);padding:12px 14px;margin:16px 0;font-size:14px;max-width:95ch}
</style></head><body><main class="pv">
<h1 class="page">Pass 2 — the 47 sub-20px Silkscreen sites</h1>
<p class="lede">Generated by the same script that will ship this, from the committed file. Every panel below is the real markup: BEFORE is the file now, AFTER has only the inline styles this pass edits. Detail panels are shown at 1.45× so 10–14px type is readable.</p>
<div class="warn"><b>The one size change:</b> the <code>1-week streak</code> chip goes 10 → 12px. 10px was legible because a pixel font is square at any size; Jakarta at 10px would be the smallest text in the product, and the app already ships that chip at <code>text-xs</code> (12px). Every other size is kept exactly — Jakarta has no 4px grid to satisfy.</div>

<h2>All 47, by role</h2>
<table class="t"><thead><tr><th>screen</th><th>text</th><th>size</th><th>role</th><th>weight</th><th>figures</th></tr></thead><tbody>${rows}</tbody></table>
<div class="warn"><b>Not in this pass:</b> the handoff's own chrome — <code>.h3.grp</code> (14px) and <code>.tag</code> (12px) — is Silkscreen for the document's wayfinding, not product UI. It stays, deliberately, and should not be cited as a counter-example.</div>

<h2 style="font-size:30px;margin-top:44px">Detail, at 1.45×</h2>
${SAMPLES.map(detail).join('')}

<h2 style="font-size:30px;margin-top:44px">Whole screens</h2>
${AFFECTED.map(screenPair).join('')}

<footer style="margin-top:60px;padding-top:16px;border-top:2px solid var(--sv-edge);font-size:13px;color:var(--sv-muted)">
${report.length} sites · ${roles.figure} figures get tabular · ${roles.unit} units at 600 · generated ${new Date().toISOString().slice(0, 10)}
</footer>
</main></body></html>`;

if (mode === 'ship') {
  fs.writeFileSync(FILE, out);
  console.log(`\nwrote ${FILE} — ${report.length} sites retyped, 0 skipped`);
} else {
  fs.writeFileSync(PREVIEW, html);
  console.log(`\nwrote ${PREVIEW} — ${report.length} sites, ${SAMPLES.length} detail panels, ${AFFECTED.length} screens (artefact untouched)`);
}
