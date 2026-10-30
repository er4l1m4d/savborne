// Vendor the pixelarticons we use out of node_modules into assets-raw, and rebuild
// icons.json from the real files so no path data is ever hand-transcribed.
// Their README sanctions exactly this: copy svg/*.svg into the project and treat as assets.
import fs from 'node:fs';

const SRC = 'node_modules/pixelarticons/svg';
const OUT = 'assets-raw/pixelarticons/svg';
const NEED = [
  // UI glyph set
  'chevron-left', 'lock', 'logout', 'shield', 'backpack', 'flag', 'sword', 'trophy', 'users', 'zap', 'arrow-right',
  // the two 8x8 chrome marks migrating to this grid
  'arrow-up', 'square-alert',
  // badge pictograms — vendored too, so the badge build does not depend on node_modules
  'map-pin', 'fire', 'money', 'anchor', 'crown',
];

fs.mkdirSync(OUT, { recursive: true });
const pkg = JSON.parse(fs.readFileSync('node_modules/pixelarticons/package.json', 'utf8'));
const icons = {};
const missing = [];
for (const name of NEED) {
  const f = `${SRC}/${name}.svg`;
  if (!fs.existsSync(f)) { missing.push(name); continue; }
  const raw = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(`${OUT}/${name}.svg`, raw);
  const paths = [...raw.matchAll(/<path[^>]*d="([^"]*)"[^>]*\/?>/g)].map((m) => m[1]);
  if (!paths.length) throw new Error(`${name}.svg has no <path d>`);
  icons[name] = paths;
}
if (missing.length) throw new Error(`not in the free set: ${missing.join(', ')}`);

const META = JSON.parse(fs.readFileSync('assets-raw/pixelarticons/icons.json', 'utf8'));
fs.writeFileSync('assets-raw/pixelarticons/icons.json', JSON.stringify({
  source: 'pixelarticons — https://github.com/halfmage/pixelarticons (npm: pixelarticons)',
  version: pkg.version || 'unknown',
  license: 'MIT (c) Gerrit Halfmann — see LICENSE.txt in this folder',
  retrieved: META.retrieved || '2026-10-17',
  method: `copied out of node_modules/pixelarticons/svg by scripts/pixelarticons-vendor.mjs — files also kept verbatim at assets-raw/pixelarticons/svg/`,
  grid: '24x24, path-only, fill=currentColor, integer coordinates (their stated design rules)',
  freeSetSize: 1036,
  icons,
  candidateFor: META.candidateFor,
}, null, 2));

// report the shape of each so we know which need polygon fill rather than rect fill
for (const name of NEED) {
  const paths = icons[name];
  let verts = 0, rects = 0;
  for (const d of paths) {
    const subs = d.split(/(?=[Mm])/).filter((s) => /^[Mm]/.test(s));
    for (const s of subs) {
      const nums = (s.match(/-?\d*\.?\d+/g) || []).length;
      verts += nums.length;
      // a plain rectangle traces exactly 4 corners => 8 coordinate numbers for M + 3 moves
      if (nums.length <= 9) rects++;
    }
  }
  console.log(`${name.padEnd(14)} paths:${paths.length}  subpaths:${verts / 2}  simple-rect-ish:${rects}`);
}
console.log(`\nvendored ${NEED.length} icons at ${OUT}/ — icons.json rebuilt from the real files (v${pkg.version})`);
