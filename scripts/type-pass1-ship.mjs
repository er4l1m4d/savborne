// Pass 1 of the type rule: screen titles move from Plus Jakarta Sans to Silkscreen.
//
// Why a script and not a hand edit: Savborne-handoff.html is ~412 KB on very few lines, and
// every previous hand splice in this repo eventually ate a closing tag. This one collects all
// matches first, refuses to write unless the count is exactly what was previewed, applies the
// edits back to front, and then re-checks tag balance before touching the file.
//
// WHAT COUNTS AS A TITLE — the rule this list encodes, and the reason it is written down.
//
// A first draft of this list matched the first Jakarta element over 22px whose text started with a
// given string. That silently picked the wrong element on three screens, because two kinds of
// "big text" exist in this file:
//
//   top-bar label   — the element that names the screen, sitting in the 36-44px top row.
//                     A_Missions "Missions" (28), A_Settings "Settings" (28),
//                     A_BalanceError "Couldn't read balance" (22), A_UpdatePay "Update Nimiq Pay" (22).
//   state headline  — a centred message inside the body, BELOW a bar that already names the screen.
//                     A_BalanceError "Couldn't read your balance" (32), A_UpdatePay "…to continue" (32).
//
// The title is the top-bar label. A screen with no top-bar label (onboarding, result, error screens
// that are nothing but the message) uses its sole heading instead — A_Welcome, A_Win, A_Withdrawal.
// A state headline on a screen that already has a title is body copy and keeps Jakarta, the same as
// A_Queue's "No longer searching" status line.
//
// A name inside a card is not a title either: A_Home and A_HomeDone both draw "Kemi" at 28px in the
// character card, so neither is retitled — treating one as a title left the same element in two faces.
//
// Each entry is [screen id, exact text, expected tag]. The tag is asserted, because "Update Nimiq Pay"
// is a substring of a different element's text on the same screen and text alone is not a key.
import fs from 'node:fs';

const FILE = 'Savborne-handoff.html';
const doc = fs.readFileSync(FILE, 'utf8');

const TITLES = [
  // onboarding — no top bar, the heading is the title
  ['A_Welcome', 'Save for real', 'h1'],
  ['A_Connect', 'Connect your savings', 'h1'],
  ['A_Privacy', 'Privacy notice', 'h1'],
  ['A_Name', 'Name your character', 'h1'],
  ['A_FirstCheckin', 'First Steps', 'h1'],
  ['A_BracketClimb', 'Bracket Climb', 'h1'],
  // tab screens — top-bar label
  ['A_Profile', 'Profile', 'span'],
  ['A_Missions', 'Missions', 'span'],
  ['A_Items', 'Items', 'span'],
  ['A_RanksRanked', 'Ranks', 'span'],
  ['A_RanksUnranked', 'Ranks', 'span'],
  ['A_Settings', 'Settings', 'span'],
  // battle entry — top-bar label (the "Battle" header is shared by four screens)
  ['A_BattleMenu', 'Battle', 'span'],
  ['A_RankedLocked', 'Battle', 'span'],
  ['A_Queue', 'Ranked', 'span'],
  ['A_QueueTimeout', 'Ranked', 'span'],
  ['A_DailyLimit', 'Battle', 'span'],
  // sheet and result screens — sole heading
  ['A_ItemSheet', 'Use an item', 'span'],
  ['A_FriendWait', 'Challenge sent', 'h1'],
  ['A_Win', 'You win!', 'h1'],
  ['A_Loss', 'You lost.', 'h1'],
  ['A_Tie', 'It\u2019s a tie.', 'h1'],
  ['A_Withdrawal', 'Your balance went down', 'h1'],
  // error screens — top-bar label is the title, the centred restatement below stays Jakarta
  ['A_UpdatePay', 'Update Nimiq Pay', 'span'],
  ['A_BalanceError', 'Couldn\u2019t read balance', 'span'],
];

const SNAP = (n) => Math.round(n / 4) * 4; // ties round up: a title never shrinks

function figureBounds(src, id) {
  const a = src.indexOf(`<figure class="scr" id="${id}">`);
  if (a < 0) throw new Error(`screen not found: ${id}`);
  const b = src.indexOf('</figure>', a);
  if (b < 0) throw new Error(`unclosed figure: ${id}`);
  return [a, b + 9];
}

// Locate the element carrying `text`, restricted to `tag`. Only the opening tag is returned, so
// the edit cannot reach anything inside the element.
function findTag(src, start, end, text, tag) {
  const needle = text.replace(/[\u2018\u2019]/g, "'");
  const block = src.slice(start, end);
  const re = new RegExp(`<${tag}\\s+style="([^"]*)"([^>]*)>`, 'g');
  for (const m of block.matchAll(re)) {
    const openEnd = m.index + m[0].length;
    const close = block.indexOf(`</${tag}>`, openEnd);
    if (close < 0) continue;
    const inner = block.slice(openEnd, close).replace(/<[^>]*>/g, '').replace(/[\u2018\u2019]/g, "'").trim();
    if (!inner.startsWith(needle)) continue;
    if (!/font-size:\s*\d+px/.test(m[1])) continue;
    return { start: start + m.index, end: start + openEnd, styleStr: m[1] };
  }
  return null;
}

const declaredFace = (style) => {
  const m = style.match(/font-family:\s*([^;]*)/);
  return m ? m[1].trim() : null;
};

// Silkscreen 400, no tracking, size on the 4-grid. A style that declares no font-family inherits
// the screen's Jakarta, so the family is prepended instead of replaced — A_Settings' header has
// no font-family at all, and assuming it did is how a naive replace would have silently no-opped.
function retitle(style, nextSize) {
  let s = style;
  if (declaredFace(s) === null) s = `font-family: 'Silkscreen', monospace; ${s}`;
  else s = s.replace(/font-family:\s*[^;]*/, "font-family: 'Silkscreen', monospace");
  s = s.replace(/font-weight:\s*\d{3}/, 'font-weight: 400');
  s = s.replace(/letter-spacing:\s*[^;]*/, 'letter-spacing: normal');
  s = s.replace(/font-size:\s*\d+px/, `font-size: ${nextSize}px`);
  return s;
}

const edits = [];
const report = [];
for (const [id, text, tag] of TITLES) {
  const [a, b] = figureBounds(doc, id);
  const t = findTag(doc, a, b, text, tag);
  if (!t) throw new Error(`title not found: ${id} "${text}" <${tag}>`);

  const face = declaredFace(t.styleStr);
  if (face !== null && !/Plus Jakarta|sv-font-ui/.test(face)) {
    throw new Error(`${id} is already in ${face} — the list is out of date`);
  }

  const size = Number((t.styleStr.match(/font-size:\s*(\d+)px/) || [])[1]);
  const weight = (t.styleStr.match(/font-weight:\s*(\d+)/) || [])[1] ?? '(none)';
  const nextSize = SNAP(size);
  if (nextSize < 20) throw new Error(`${id} would land at ${nextSize}px — below the 20px boundary`);

  const newStyle = retitle(t.styleStr, nextSize);

  if (newStyle === t.styleStr) throw new Error(`no change produced for ${id} — pattern did not match`);
  if (!newStyle.includes("Silkscreen")) throw new Error(`face did not change for ${id}`);
  if (/Jakarta/.test(newStyle)) throw new Error(`Jakarta survived in ${id}`);

  edits.push({ id, start: t.start, end: t.end, was: doc.slice(t.start, t.end), now: doc.slice(t.start, t.end).replace(t.styleStr, newStyle) });
  report.push({ id, text, tag, size, nextSize, weight });
}

// --- assertions before writing -------------------------------------------------
if (edits.length !== TITLES.length) throw new Error(`expected ${TITLES.length} edits, got ${edits.length}`);

// The list above is grouped by role, not by position in the file, so sort before checking adjacency.
edits.sort((x, y) => x.start - y.start);
const overlaps = edits.some((e, i) => i > 0 && e.start < edits[i - 1].end);
if (overlaps) throw new Error('overlapping edits — refusing to write');

const countTags = (s, tag) => ({
  open: (s.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length,
  close: (s.match(new RegExp(`</${tag}>`, 'g')) || []).length,
});
const before = {};
for (const tag of ['div', 'span', 'svg', 'h1', 'p', 'figure']) before[tag] = countTags(doc, tag);

// apply back to front so earlier offsets stay valid
let out = doc;
for (const e of [...edits].sort((x, y) => y.start - x.start)) out = out.slice(0, e.start) + e.now + out.slice(e.end);

for (const tag of Object.keys(before)) {
  const now = countTags(out, tag);
  if (now.open !== before[tag].open || now.close !== before[tag].close) {
    throw new Error(`tag balance changed for <${tag}>: ${JSON.stringify(before[tag])} -> ${JSON.stringify(now)}`);
  }
}
const silkscreenBefore = (doc.match(/font-family: 'Silkscreen', monospace/g) || []).length;
const silkscreenAfter = (out.match(/font-family: 'Silkscreen', monospace/g) || []).length;
if (silkscreenAfter - silkscreenBefore !== TITLES.length) {
  throw new Error(`Silkscreen occurrences moved ${silkscreenBefore} -> ${silkscreenAfter}, expected +${TITLES.length}`);
}

// Post-condition: re-read the edited string and prove every title is Silkscreen at the size the
// report claims. This replaces a text-window heuristic that could pass while the element it meant
// to check sat a few hundred characters away.
const wrong = [];
for (const r of report) {
  const [a, b] = figureBounds(out, r.id);
  const t = findTag(out, a, b, r.text, r.tag);
  if (!t) { wrong.push(`${r.id}: element vanished`); continue; }
  if (!/Silkscreen/.test(t.styleStr)) { wrong.push(`${r.id}: still not Silkscreen`); continue; }
  if (!new RegExp(`font-size: ${r.nextSize}px`).test(t.styleStr)) wrong.push(`${r.id}: size != ${r.nextSize}px`);
}
if (wrong.length) throw new Error(`post-check failed:\n  ${wrong.join('\n  ')}`);

fs.writeFileSync(FILE, out);
console.log(`wrote ${FILE} — ${edits.length} titles retitled, 0 skipped`);
for (const r of report) {
  console.log(`  ${r.id.padEnd(16)} ${String(r.size).padStart(2)}px${r.size === r.nextSize ? '   ' : ` -> ${String(r.nextSize).padStart(2)}px`} w${r.weight} <${r.tag}>`);
}
