// Ship items into the handoff: swap 12x12 item art -> new 16x16, rename Ledger Scroll->Tome, update manifest
import fs from 'node:fs';
let h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const items = JSON.parse(fs.readFileSync('assets/items.json', 'utf8'));
const log = [];

// map handoff aria-label (may have ", locked") -> items.json key
const MAP = {
  'Cloth Purse': 'Cloth Purse', 'Ledger Scroll': 'Ledger Tome', 'Ledger Tome': 'Ledger Tome', 'Bronze Shield': 'Bronze Shield',
  'Copper Compass': 'Copper Compass', 'Silver Blade': 'Silver Blade', 'Silver Charm': 'Silver Charm',
  'Gold Gauntlet': 'Gold Gauntlet', 'Golden Crown': 'Golden Crown',
};

// Replace any item svg (any grid size, labeled) whose aria-label base matches — always converge to current art.
let total = 0;
h = h.replace(/<svg\b([^>]*)>([\s\S]*?)<\/svg>/g, (m, attrs, inner) => {
  if (!/viewBox="0 0 (8 8|12 12|16 16)"/.test(attrs)) return m;
  const label = (attrs.match(/aria-label="([^"]+)"/) || [])[1];
  if (!label) return m;
  const key = MAP[label.split(',')[0].trim()];
  if (!key || !items[key]) return m;
  total++;
  const na = attrs
    .replace(/viewBox="0 0 (?:8 8|12 12|16 16)"/, 'viewBox="0 0 16 16"')
    .replace(/aria-label="[^"]*"/, `aria-label="${label.replace('Ledger Scroll', 'Ledger Tome')}"`);
  return `<svg${na}>${items[key]}</svg>`;
});
log.push(`labeled item svgs swapped: ${total}`);

// ItemSheet: 5 unlabeled 36px 8x8 decorative icons in order -> new art
const SHEET_ORDER = ['Cloth Purse', 'Bronze Shield', 'Copper Compass', 'Silver Blade', 'Gold Gauntlet'];
const si = h.indexOf('id="A_ItemSheet"');
const sj = h.indexOf('</figure>', si);
let sheetSeg = h.slice(si, sj);
let si_i = 0;
sheetSeg = sheetSeg.replace(/<svg width="36" height="36" viewBox="0 0 8 8"([^>]*)>[\s\S]*?<\/svg>/g, (m, rest) => {
  const name = SHEET_ORDER[si_i++];
  if (!name || !items[name]) return m;
  return `<svg width="36" height="36" viewBox="0 0 16 16"${rest}>${items[name]}</svg>`;
});
h = h.slice(0, si) + sheetSeg + h.slice(sj);
log.push(`ItemSheet icons swapped: ${si_i}`);

// Pixel-art gallery cards: <svg width="60" height="60" viewBox="0 0 12 12">...</svg><code>Name</code>
let gal = 0;
for (const [label, key] of Object.entries(MAP)) {
  const re = new RegExp('<svg width="60" height="60" viewBox="0 0 (?:12 12|16 16)">[\\s\\S]*?</svg>(<code>' + label.replace('Ledger Scroll', 'Ledger Tome') + '</code>)');
  h = h.replace(re, `<svg width="60" height="60" viewBox="0 0 16 16">${items[key]}</svg>$1`.replace('$1', `$1`.replace(label, label === 'Ledger Scroll' ? 'Ledger Tome' : label)));
  if (re.test(h) === false) gal++;
  // also fix stale gallery caption for the tome
}
h = h.split('<code>Ledger Scroll</code>').join('<code>Ledger Tome</code>');
log.push(`gallery cards refreshed: ${gal}`);

// Rename remaining prose/label occurrences of the item name
const before = (h.match(/Ledger Scroll/g) || []).length;
h = h.split('Ledger Scroll').join('Ledger Tome');
log.push(`'Ledger Scroll' text renamed: ${before} occurrence(s)`);

fs.writeFileSync('Savborne-handoff.html', h);

// manifest: merge items section
const man = JSON.parse(fs.readFileSync('assets/manifest.json', 'utf8'));
man.items = {
  'Cloth Purse': 'hand-drawn pouch, cloth ramps', 'Ledger Tome': 'renamed from Ledger Scroll; hand-drawn tome',
  'Bronze Shield': 'programmatic v2 heater (replaces r8c6 recolor)', 'Copper Compass': 'programmatic v2',
  'Silver Blade': 'pack sword r8c10', 'Silver Charm': 'hand-drawn, bible ramps',
  'Gold Gauntlet': 'programmatic v2', 'Golden Crown': 'programmatic v2',
};
man.signedOff = { ledgerTomeRename: '2026-10-16' };
fs.writeFileSync('assets/manifest.json', JSON.stringify(man, null, 2));
console.log(log.join('\n'));
