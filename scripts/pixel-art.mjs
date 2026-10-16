// Savborne pixel-art generator + handoff injector (round 2)
// Designs: duotone 12x12 icons, 16x24 hero (4 gears) + rival (2 frames), 12x12 items (x8)
import fs from 'node:fs';

/* ---------- grid -> svg ---------- */
const PAL = {
  k: '#0C1211', c: '#F3EEDD', o: '#A9B8B2', m: '#6FD0AE', r: '#F2735A', d: '#A8452F',
  t: '#D9A066', b: '#8A5A2B', z: '#E08A5B', s: '#C9D3DC', g: '#7A8B94', y: '#E8C14A',
  u: '#9A7420', f: '#4B5A56', w: '#243532',
};
// grid: array of equal-length strings. opt: {char:{opacity}}
// returns {w,h,paths:[{fill,opacity?,d}]}
function gridToPaths(rows0, opt = {}) {
  const W = rows0[0].length;
  const rows = rows0.map((r) => (r.length === W ? r : r.length > W ? r.slice(0, W) : r.padEnd(W, '.')));
  const H = rows.length;
  const byColor = new Map();
  for (let y = 0; y < H; y++) {
    let x = 0;
    while (x < W) {
      const ch = rows[y][x];
      if (ch === '.' || !PAL[ch]) { x++; continue; }
      let run = 1;
      while (x + run < W && rows[y][x + run] === ch) run++;
      if (!byColor.has(ch)) byColor.set(ch, []);
      byColor.get(ch).push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  }
  const paths = [];
  for (const [ch, ds] of byColor) {
    const o = opt[ch];
    paths.push({ fill: PAL[ch], opacity: o?.opacity, d: ds.join('') });
  }
  return { w: W, h: H, paths };
}
function svg(g, attrs) {
  const ps = g.paths.map((p) =>
    `<path${p.opacity ? ` fill-opacity="${p.opacity}"` : ''} fill="${p.fill}" shape-rendering="crispEdges" d="${p.d}"></path>`
  ).join('');
  return `<svg ${attrs} viewBox="0 0 ${g.w} ${g.h}">${ps}</svg>`;
}
// icon variant: primary char -> currentColor, others keep palette
function iconSvg(rows0, attrs, primary = '#') {
  const W = rows0[0].length;
  const rows = rows0.map((r) => (r.length === W ? r : r.length > W ? r.slice(0, W) : r.padEnd(W, '.')));
  const H = rows.length;
  const byColor = new Map();
  for (let y = 0; y < H; y++) for (let x = 0; x < W;) {
    const ch = rows[y][x];
    if (ch === '.') { x++; continue; }
    let run = 1; while (x + run < W && rows[y][x + run] === ch) run++;
    if (!byColor.has(ch)) byColor.set(ch, []);
    byColor.get(ch).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  const ps = [...byColor].map(([ch, ds]) => {
    const fill = ch === primary ? 'currentColor' : PAL[ch];
    const op = ch === primary ? '' : ' fill-opacity="0.55"';
    return `<path fill="${fill}"${op} shape-rendering="crispEdges" d="${ds.join('')}"></path>`;
  }).join('');
  return `<svg ${attrs} viewBox="0 0 ${W} ${H}">${ps}</svg>`;
}
const R = (spec, W = 12) => { // "x,y x,y" cells -> rows
  const rows = Array.from({ length: spec.split('\n').length }, () => '.'.repeat(W));
  let y = 0;
  for (const line of spec.split('\n')) {
    for (const cell of line.trim().split(/\s+/)) {
      if (!cell) continue;
      const [x, yy] = cell.split(',').map(Number);
      rows[yy][x] = '#';
    }
    y++;
  }
  return rows.map((r) => r.join(''));
};

/* ---------- icons (12x12, primary '#') ---------- */
const ICONS = {
  home: [".....##.....", "....####....", "...######...", "..########..", "...######...", "...##..##...", "...##..##...", "...##..##...", "...######...", "............", "............", "............"],
  missions: [".##.........", ".##.#####...", ".##.#######.", ".##.#####...", ".##.###.....", ".##.........", ".##.........", ".##.........", ".##.........", ".##.........", ".##.........", "............"],
  battle: ["#.#......#.#", ".##......##.", "..##....##..", "...#....#...", "....####....", "....####....", "...#....#...", "..##....##..", ".##......##.", "#.#......#.#", "............", "............"],
  ranks: ["....####....", "....####....", "##..####..##", "##..####..##", "##..####..##", "############", "............", "............", "............", "............", "............", "............"],
  profile: ["....####....", "....####....", "....####....", "............", "..########..", ".##########.", "############", "############", "............", "............", "............", "............"],
  back: ["....#.......", "...##.......", "..###.......", ".####.......", "..###.......", "...##.......", "....#.......", "............", "............", "............", "............", "............"],
  check: [".........##.", "........###.", "...##..###..", "....####....", ".....##.....", "............", "............", "............", "............", "............", "............", "............"],
  lock: ["....####....", "...##..##...", "...##..##...", "..########..", "..########..", "..########..", "..########..", "..########..", "............", "............", "............", "............"],
};

/* ---------- items (12x12) ---------- */
const ITEMS = {
  'Cloth Purse': ["..cc....cc..", "..cc....cc..", "....cccc....", "...bbbbbb...", "..bbbbbbbb..", ".bbbbbbbbbb.", ".bbbbbbbbbb.", ".bttbbbbttb.", ".bbbbbbbbbb.", "..bbbbbbbb..", "..dddddddd..", "...dddddd..."],
  'Ledger Scroll': ["...kkkkkk...", ".bbbbbbbbbb.", ".bccccccccb.", ".bckkkkkkkcb", ".bccccccccb.", ".bckkkkkccb.", ".bccccccccb.", ".bckkkkkkcb.", ".bccccccccb.", ".bbbbbbbbbb.", "...kkkkkk...", "............"],
  'Bronze Shield': [".zzzzzzzzzz.", ".zzzzzzzzzz.", ".zzkzzzzkzz.", ".zzzkkkzzz..", ".zzzkdkzzz..", "..zzzdz.zz..", "..zzkkkzz...", "...zzdzz....", "....zzz.....", "...zzizz....", "...zzzzz....", "....zzz....."],
  'Copper Compass': ["....zzzz....", "..zzzzzzzz..", ".zzcccccczz.", ".zccccccczz.", ".zcccccrrz..", ".zcccrcrrz..", ".zccrccczz..", ".zcrrccczz..", ".zccccccczz.", ".zzcccccczz.", "..zzzzzzzz..", "....zzzz...."],
  'Silver Blade': ["..........s.", ".........css", "........css.", ".......css..", "......css...", ".....css....", "....css.....", "...css......", "..yyy.......", ".ff.........", "y...........", "............"],
  'Silver Charm': [".....ss.....", ".....ss.....", "...ssssss...", "..s......s..", "..s.mm..m.s.", ".s...mm...s.", ".s..mmmm..s.", ".s..mmmm..s.", "..s.....s...", "...ssssss...", "............", "............"],
  'Gold Gauntlet': ["...y...y....", "..yyy.yyy...", "..yyy.yyy...", "..uuu.uuu...", "yyyyyyyyyyy.", "yyyyyyyyyyy.", "yyyyyyyyyyy.", "yyyccyyyyyy.", "uuuuuuuuuuu.", ".yyyyyyyyyy.", ".uuuuuuuuuu.", "..uuuuuuuu.."],
  'Golden Crown': ["..y..y..y...", "..yyy.yyy...", "yyyyyyyyyyy.", "yyyyryyyyyy.", "yyyyyyyyyyy.", ".uuuuuuuuuu.", "............", "............", "............", "............", "............", "............"],
};
// item colors: map '#'-style per item with named palette chars
const ITEM_DATA = {
  'Cloth Purse': { rows: ITEMS['Cloth Purse'] },
  'Ledger Scroll': { rows: ITEMS['Ledger Scroll'] },
  'Bronze Shield': { rows: ITEMS['Bronze Shield'] },
  'Copper Compass': { rows: ITEMS['Copper Compass'] },
  'Silver Blade': { rows: ITEMS['Silver Blade'] },
  'Silver Charm': { rows: ITEMS['Silver Charm'] },
  'Gold Gauntlet': { rows: ITEMS['Gold Gauntlet'] },
  'Golden Crown': { rows: ITEMS['Golden Crown'] },
};

/* ---------- sprites (16x24) ---------- */
const HEAD = [
  '.....bbbbbb.....'.slice(0, 16),
  '....bbbbbbbb....',
  '...bbbbbbbbbb...',
  '...bbttttttbb...',
  '...btkttttktb...',
  '...tttttttttt...',
  '....tttttttt....',
  '....tttccttt....',
];
const LEGS_ROWS = [
  '.....pp..pp.....',
  '.....pp..pp.....',
  '.....pp..pp.....',
  '.....pp..pp.....',
  '.....pp..pp.....',
  '.....pp..pp.....',
  '....kkk..kkk....',
  '...kkkk..kkkk...',
];
function hero(gear) {
  const GOLD_HEAD = [
    '....y..y..y.....',
    '....yyyyyyy.....',
    '....bbbbbbbb....',
    '...bbbbbbbbbb...',
    '...bbttttttbb...',
    '...btkttttktb...',
    '...tttttttttt...',
    '....tttttttt....',
  ];
  const P = {
    entry: [
      '...cccccccccc...',
      '..cccccccccccc..',
      '..ccmmccccmmcc..',
      '..ccmmccccmmcc..',
      '..tccccccccccct..',
      '..tccccccccccct..',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
    ],
    bronze: [
      '...zzzzzzzzzz...',
      '..zzzzzzzzzzzz..',
      '..zzddzzzzddzz..',
      '..zzddzzzzddzz..',
      '..tzzzzzzzzzzt..',
      '..tzzzzzzzzzzt..',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
    ],
    silver: [
      '...ssssssssss...',
      '..mmssssssssss..',
      '..mmssggggssss..',
      '..mmssggggssss..',
      '..msssssssssst..',
      '..tsssssssssst..',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
    ],
    gold: [
      '...yyyyyyyyyy...',
      '..rryyyyyyyyyy..',
      '..rryyuuuuuyyy..',
      '..rryyuuuuuyyy..',
      '..ryyyyyyyyyyt..',
      '..ryyyyyyyyyyt..',
      '...bbbbbbbbbb...',
      '....bbbbbbbb....',
    ],
  };
  const body = P[gear];
  const legs = LEGS_ROWS.map((r) => r.replaceAll('p', 'w'));
  const head = gear === 'gold' ? GOLD_HEAD : HEAD;
  return [...head, ...body, ...legs];
}
// attack frame: silver hero, sword raised right (cols 13-15 rows 0-7), arm up
function heroAttack() {
  const g = hero('silver').map((r) => r.split(''));
  // arm up: hand to cols 13-14 row 8
  g[8][13] = 't'; g[8][14] = 't';
  // sword blade diagonal top-right
  const blade = [[14, 0, 's'], [13, 1, 'c'], [13, 1, 's'], [12, 2, 'c'], [12, 2, 's'], [11, 3, 'c'], [11, 3, 's'], [11, 4, 'c'], [11, 4, 's'], [10, 5, 'c'], [10, 5, 's']];
  for (const [x, y, ch] of [[15, 0, 's'], [14, 1, 's'], [14, 2, 'c'], [13, 2, 's'], [13, 3, 'c'], [12, 4, 'c'], [12, 5, 's'], [11, 6, 'y'], [10, 6, 'y']]) {
    if (g[y]) g[y][x] = ch;
  }
  return g.map((r) => r.join(''));
}
const RIVAL = [
  '.....kkkkkk.....',
  '....kfffffk.....',
  '...kffffffffk...',
  '...kfwkkkwkfk...',
  '....kwwwwwwk....',
  '.....kwwwwk.....',
  '......kkkk......',
  '................',
  '..ffffffffffff..',
  '.ffffffffffffff.',
  '.ffrrffffffrrf..',
  '.ffrrffffffrrf..',
  '.ffrrffffffrrft.',
  '.ffffffffffffft.',
  '..ffffffffffff..',
  '..wwwwwwwwwwww..',
  '.....ww..ww.....',
  '.....ww..ww.....',
  '.....ww..ww.....',
  '.....ww..ww.....',
  '.....kk..kk.....',
  '....kkk..kkk....',
  '...kkkk..kkkk...',
  '................',
];
const RIVAL_ATTACK = RIVAL.map((r) => r.split(''));
[[1, 8, 'r'], [0, 9, 'r'], [1, 10, 'r'], [0, 11, 'r'], [1, 12, 'r'], [2, 12, 'r']].forEach(([x, y, ch]) => { RIVAL_ATTACK[y][x] = ch; });
for (let i = 0; i < 16; i++) RIVAL_ATTACK[8][i + 0] = 'f';
const rivalAttackRows = RIVAL_ATTACK.map((r) => r.join(''));

/* ---------- build svgs ---------- */
const navIconAttrs = { home: 'width="24" height="24" aria-hidden="true"', };
function icon(name, attrs) { return iconSvg(ICONS[name], attrs); }
const PX = (name, px = 24) => icon(name, `width="${px}" height="${px}" aria-hidden="true" focusable="false"`);

const ITEM_SVG = {};
for (const [name, d] of Object.entries(ITEM_DATA)) {
  ITEM_SVG[name] = svg(gridToPaths(d.rows), `width="36" height="36" role="img" aria-label="${name}"`);
}
const SPRITE = {
  entry: svg(gridToPaths(hero('entry')), 'class="spr" shape-rendering="crispEdges"'),
  bronze: svg(gridToPaths(hero('bronze')), 'class="spr" shape-rendering="crispEdges"'),
  silver: svg(gridToPaths(hero('silver')), 'class="spr" shape-rendering="crispEdges"'),
  gold: svg(gridToPaths(hero('gold')), 'class="spr" shape-rendering="crispEdges"'),
  rival: svg(gridToPaths(RIVAL), 'class="spr" shape-rendering="crispEdges"'),
  attack: svg(gridToPaths(heroAttack()), 'class="spr" shape-rendering="crispEdges"'),
  rivalAttack: svg(gridToPaths(rivalAttackRows), 'class="spr" shape-rendering="crispEdges"'),
};

/* ---------- inject into Savborne-handoff.html ---------- */
let c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const log = [];
const replaceAll = (re, fn, label) => { let n = 0; c = c.replace(re, (...a) => { n++; return fn(...a); }); log.push(`${label}: ${n}`); return n; };

// 1. stroke-icons -> pixel icons (map by path d)
const D_MAP = {
  'M4 11l8-7 8 7v9h-5v-6H9v6H4z': 'home',
  'M4 20L20 4M15 4h5v5M20 20L4 4M4 9V4h5': 'battle',
  'M5 6l2 2 3-3M5 14l2 2 3-3M13 7h7M13 15h7': 'missions',
  'M5 20v-8h4v8M10 20V5h4v15M15 20V9h4v11': 'ranks',
  'M4 20c0-4 4-6 8-6s8 2 8 6': 'profile',
  'M15 5l-7 7 7 7': 'back',
  'M5 12l5 5 9-10': 'check',
  'M6 6l12 12M18 6L6 18': 'back', // X / leave -> reuse back glyph? no: define 'leave'
};
ICONS.leave = ["##........##", ".##....##...", "..####....", "...####...", "..####....", ".##....##...", "##........##", "............", "............", "............", "............", "............"];
D_MAP['M6 6l12 12M18 6L6 18'] = 'leave';
ICONS.shield = ['..########..', '..########..', '..########..', '..##....##..', '...######...', '....####....', '.....##.....', '............', '............', '............', '............', '............'].map((r) => r.slice(0, 12).padEnd(12, '.'));
D_MAP['M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z'] = 'shield';

D_MAP['M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5M17 5a3.5 3.5 0 010 7M19 14.5c2 .7 3 2.2 3 4.5'] = 'profile';
D_MAP['M4 7h10M18 7h2M4 17h2M10 17h10'] = 'back'; // friend share/link arrow -> back glyph acceptable? map to missions
D_MAP['M4 7h10M18 7h2M4 17h2M10 17h10'] = 'missions';
D_MAP['M12 3v4M9 12h.01M15 12h.01M9 18v3M15 18v3'] = 'lock'; // question -> lock-ish info; keep lock
D_MAP['M4 20L20 4M15 4h5v5M7 17l-3 3M9 15l-3-3'] = 'battle';
D_MAP['M6 9h12l1 11H5zM9 9a3 3 0 016 0'] = 'home'; // bag -> home? it's "items" bag; map to a new icon
ICONS.bag = ['....####....', '..########..', '.##########.', '.##########.', '.##########.', '.##########.', '..########..', '............', '............', '............', '............', '............'];
D_MAP['M6 9h12l1 11H5zM9 9a3 3 0 016 0'] = 'bag';
D_MAP['M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7z'] = 'ranks'; // star -> ranks
D_MAP['M3 9a14 14 0 0118 0M6 13a9 9 0 0112 0M9.5 17a4 4 0 015 0M4 4l16 16'] = 'missions'; // offline -> missions

let iconSwaps = 0;
c = c.replace(/<svg (?:(?!>)[\s\S])*?stroke="currentColor"[\s\S]*?<\/svg>/g, (tag) => {
  const d = (tag.match(/<path d="([^"]*)"/) || [])[1];
  if (!d) return tag;
  // preserve size + aria attrs
  const size = (tag.match(/width="(\d+)"/) || [])[1] || '24';
  const style = (tag.match(/style="([^"]*)"/) || [])[1];
  const name = D_MAP[d];
  if (!name) { log.push('UNMAPPED: ' + d.slice(0, 40)); return tag; }
  iconSwaps++;
  let attrs = `width="${size}" height="${size}" aria-hidden="true" focusable="false"`;
  if (style) attrs += ` style="${style}"`;
  return icon(name, attrs);
});
log.push('stroke->pixel icons: ' + iconSwaps);

// 2. sprites
const SIZE = { '0 0 12 16': null };
let spriteSwaps = 0;
c = c.replace(/<div role="img" aria-label="([^"]*)" style="([^"]*)"><svg class="spr"[\s\S]*?<\/svg>/g, (tag, label, style) => {
  const W = parseFloat((style.match(/width:\s*([\d.]+)px/) || [])[1]) || 96;
  const H = parseFloat((style.match(/height:\s*([\d.]+)px/) || [])[1]) || 132;
  const s = Math.max(4, Math.min(8, Math.min(Math.floor(W / 16), Math.floor(H / 24))));
  const isFoe = /Opponent/.test(label);
  let key;
  if (isFoe) key = 'rival';
  else if (/Cloth Purse/.test(label)) key = 'entry';
  else key = 'silver';
  const inner = SPRITE[key]
    .replace('class="spr"', `class="spr" width="${16 * s}" height="${24 * s}" style="max-width:100%" preserveAspectRatio="xMidYMid meet"`);
  spriteSwaps++;
  return tag.replace(/<svg class="spr"[\s\S]*?<\/svg>/, inner);
});
log.push('sprites replaced: ' + spriteSwaps);

// battle/arena contexts deserve the attack frame note only — keep idle art, frames shown in new section.

// 3. Items screen art swap
let itemSwaps = 0;
for (const [name, art] of Object.entries(ITEM_SVG)) {
  const re = new RegExp('<svg width="36" height="36" viewBox="0 0 8 8" role="img" aria-label="' + name.replace(/[ ,]/g, '[ ,]') + '[^"]*">[\\s\\S]*?</svg>');
  if (re.test(c)) { c = c.replace(re, art); itemSwaps++; }
  else log.push('item not found: ' + name);
}
log.push('item art swapped: ' + itemSwaps);

// 4. chips 30 -> 24 in screens (inline) + component CSS + docs
c = c.split('height: 30px; padding: 0 12px;').join('height: 24px; padding: 0 10px;');
c = c.split('.sv-chip{height:30px;padding:0 12px;').join('.sv-chip{height:24px;padding:0 10px;');
c = c.split('<code>30px high, Silkscreen 12</code>').join('<code>24px high, Silkscreen 12</code>');
c = c.split('Chips</td><td>30px high').join('Chips</td><td>24px high');

// 5. header slim: Home screens icon+wordmark smaller
c = c.replace(/<div style="display: flex; align-items: center; gap: 10px">(\s*)<svg width="36" height="36" viewBox="0 0 24 24" role="img" aria-label="Savborne">/g, (m) => m.replace('gap: 10px">', 'gap: 8px">').replace('width="36" height="36"', 'width="30" height="30"'));
c = c.split('<svg width="164" height="14" viewBox="0 0 82 7" role="img" aria-label="Savborne wordmark">').join('<svg width="116" height="10" viewBox="0 0 82 7" role="img" aria-label="Savborne wordmark">');
// wordmark in sidebar/brand section keep original: restore the two chrome copies
c = c.split('<aside class="side">\n<svg width="116" height="10" viewBox="0 0 82 7"').join('<aside class="side">\n<svg width="164" height="14" viewBox="0 0 82 7"');
c = c.split('<div><svg width="116" height="10" viewBox="0 0 82 7" role="img" aria-label="Savborne wordmark">').join('<div><svg width="164" height="14" viewBox="0 0 82 7" role="img" aria-label="Savborne wordmark">');

// 6. tab screens wordmark header -> page title
const FIG = c.split(/(?=<figure class="scr")/);
let titleSwaps = 0;
for (let i = 0; i < FIG.length; i++) {
  const f = FIG[i];
  const idm = f.match(/<figure class="scr" id="([^"]+)"/);
  if (!idm) continue;
  const id = idm[1];
  if (['A_Welcome', 'A_Home', 'A_HomeDone'].includes(id)) continue;
  if (!f.includes('aria-label="Savborne wordmark"')) continue;
  const title = { A_Missions: 'Missions', A_Profile: 'Profile', A_BattleMenu: 'Battle', A_RankedLocked: 'Battle', A_RanksRanked: 'Ranks', A_RanksUnranked: 'Ranks', A_Settings: 'Settings' }[id];
  if (!title) continue;
  FIG[i] = f.replace(
    /<div style="display: flex; align-items: center; gap: 8px">[\s\S]*?<\/svg>\n<\/div>/,
    `<span style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.02em">${title}</span>`
  );
  if (FIG[i] !== f) titleSwaps++;
}
c = FIG.join('');
log.push('tab headers -> title: ' + titleSwaps);

// 7. header row heights 44 -> 36 only in top-bar context
c = c.split('justify-content: space-between; height: 44px">').join('justify-content: space-between; height: 36px">');

// 8. new Pixel art section
const iconRow = Object.entries(ICONS).map(([n, rows]) =>
  `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px">${iconSvg(rows, 'width="48" height="48" focusable="false"')}<code>${n}</code></div>`).join('\n');
const itemRow = Object.keys(ITEM_SVG).map((n) => {
  const art = ITEM_SVG[n].replace('width="36" height="36"', 'width="60" height="60"');
  return `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px">${art.replace(/ role="img" aria-label="[^"]*"/, '')}<code>${n}</code></div>`;
}).join('\n');
const sprCell = (key, label, scale = 5) => `<div class="card" style="display:flex;flex-direction:column;align-items:center;gap:8px;background:#0E1716">${SPRITE[key].replace('class="spr"', `class="spr" width="${16 * scale}" height="${24 * scale}"`)}<code>${label}</code></div>`;
const artSection = `
<h2 id="art">Pixel art</h2>
<p>Icons, sprites and item art are final, hand-drawn on fixed grids: icons <b>12×12</b> (duotone — primary stroke color + 55% secondary), characters <b>16×24</b>, items <b>12×12</b>. Every sprite is an exact whole-pixel scale (4×–8×), <code>shape-rendering: crispEdges</code>, no anti-aliasing, no rotation. Art palette (art-only, never UI surfaces): skin <code>#D9A066</code> / <code>#8A5A2B</code>, bronze <code>#E08A5B</code> / <code>#A8452F</code>, steel <code>#C9D3DC</code> / <code>#7A8B94</code>, gilt <code>#E8C14A</code> / <code>#9A7420</code>; all darks/lights otherwise reuse UI tokens.</p>
<h3>Icon set</h3>
<p>Nav + glyph icons use <code>currentColor</code>: tabs render <code>muted</code> (off) and <code>mint</code> (active). Never stroke icons, never rounded joins — this replaces the previous line-icon set everywhere, screens included.</p>
<div class="cards">${iconRow}</div>
<h3>Character sprites</h3>
<p>The hero has <b>4 bracket gears</b> (Entry cloth → Bronze plate → Silver steel with mint cloak → Gold gilt with coral cloak and crown points); the opponent is a <b>separate rival character</b> (dark hood, coral scarf, heavier frame) shown in their bracket gear colorway. Idle animation is a 1px two-frame bob in CSS (<code>steps(2)</code>); attack frames below are the reference pose for turn-reveal/lunge.</p>
<div class="cards">${sprCell('entry', 'Hero · Entry')}${sprCell('bronze', 'Hero · Bronze')}${sprCell('silver', 'Hero · Silver')}${sprCell('gold', 'Hero · Gold')}${sprCell('rival', 'Rival · default')}${sprCell('attack', 'Hero · attack frame')}${sprCell('rivalAttack', 'Rival · attack frame')}</div>
<h3>Item art</h3>
<p>All 8 items, 12×12 at 3× in cards (shown here at 5×). Locked items keep the silhouette but render in <code>off #4B5A56</code>.</p>
<div class="cards">${itemRow}</div>
`;
c = c.replace('<h2 id="components">', artSection + '\n<h2 id="components">');
c = c.replace('<a href="#brand">Brand assets</a>', '<a href="#brand">Brand assets</a><a href="#art">Pixel art</a>');
log.push('Pixel art section inserted');

fs.writeFileSync('Savborne-handoff.html', c);
fs.writeFileSync('scripts/pixel-art-report.txt', log.join('\n'));
console.log(log.join('\n'));
