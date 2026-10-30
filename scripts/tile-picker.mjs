// Interactive Kenney Tiny Dungeon tile picker: click tiles -> copyable coordinate list for the director
import fs from 'node:fs';
import zlib from 'node:zlib';

function decodePng(buf) {
  let pos = 8; let w, h, ctype, idat = [];
  const plte = []; let trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.slice(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ctype = data[9]; }
    else if (type === 'PLTE') { for (let i = 0; i < data.length; i += 3) plte.push([data[i], data[i + 1], data[i + 2]]); }
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = ctype === 3 ? 1 : (ctype === 6 ? 4 : 3);
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++]; const line = raw.slice(rp, rp + stride); rp += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], cc = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v = (v + a) & 255; else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) { const p = a + b - cc, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - cc); v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc)) & 255; }
      cur[x] = v;
    }
  }
  return { w, h, ctype, plte, trns, out, stride };
}
const P = decodePng(fs.readFileSync('assets-raw/kenney_tinydungeon/Tilemap/tilemap_packed.png'));
const hexOf = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
const pxAt = (x, y) => {
  if (P.ctype === 6) { const i = y * P.stride + x * 4; return [P.out[i], P.out[i + 1], P.out[i + 2], P.out[i + 3]]; }
  if (P.ctype === 2) { const i = y * P.stride + x * 3; return [P.out[i], P.out[i + 1], P.out[i + 2], 255]; }
  const idx = P.out[y * P.stride + x]; const c = P.plte[idx] || [0, 0, 0];
  return [c[0], c[1], c[2], P.trns && P.trns[idx] !== undefined ? P.trns[idx] : 255];
};
function tileSvg(r, c) {
  const byColor = new Map();
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16;) {
    const p = pxAt(c * 16 + x, r * 16 + y);
    if (p[3] < 128) { x++; continue; }
    const col = hexOf(p);
    let run = 1; while (x + run < 16) { const q = pxAt(c * 16 + x + run, r * 16 + y); if (q[3] < 128 || hexOf(q) !== col) break; run++; }
    if (!byColor.has(col)) byColor.set(col, []);
    byColor.get(col).push(`M${x} ${y}h${run}v1h-${run}z`);
    x += run;
  }
  return [...byColor].map(([col, ds]) => `<path fill="${col}" shape-rendering="crispEdges" d="${ds.join('')}"/>`).join('');
}
const USED = {
  '2,5': 'nav Home', '7,5': 'nav Missions', '8,10': 'nav Battle + Silver Blade', '5,5': 'nav Ranks', '7,1': 'nav Profile + Hero Entry',
  '8,6': 'Bronze Shield', '10,10': 'scroll tile (Ledger Tome art is hand-built)', '8,2': 'Hero Bronze', '8,0': 'Hero Silver/Gold',
  '9,0': 'Rival · Mint Wraith', '10,1': 'Rival · Hollow Ghost', '9,3': 'Rival · Hooded Miser', '9,1': 'Rival · Cutpurse',
};
let cells = '';
for (let r = 0; r < 11; r++) for (let c = 0; c < 12; c++) {
  const n = String(r * 12 + c).padStart(4, '0');
  const used = USED[`${r},${c}`];
  cells += `<div class="cell${used ? ' used' : ''}" data-ref="r${r}c${c}" title="${used || 'click to select'}">
    <svg width="96" height="96" viewBox="0 0 16 16">${tileSvg(r, c)}</svg>
    <div class="lbl">r${r} c${c} · ${n}</div>${used ? `<div class="tag">${used}</div>` : ''}
  </div>`;
}
fs.writeFileSync('assets-raw/tile-picker.html', `<!doctype html><html><head><meta charset="utf-8"><title>Kenney Tiny Dungeon — tile picker</title><style>
body{background:#0C1211;color:#F3EEDD;font:600 13px system-ui;padding:20px;margin:0 260px 20px 20px}
h1{font-size:19px} .note{color:#A9B8B2;max-width:820px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;margin-top:14px}
.cell{background:#151F1D;border:2px solid #2E4642;padding:6px;text-align:center;cursor:pointer;position:relative}
.cell:hover{border-color:#C9C1A8}
.cell.sel{border-color:#6FD0AE;box-shadow:0 0 0 2px #6FD0AE}
.cell.used{border-color:#C9C1A8}
svg{background:#0E1716;image-rendering:pixelated}
.lbl{color:#A9B8B2;font-size:10px;margin-top:4px}
.tag{position:absolute;top:2px;left:2px;background:#6FD0AE;color:#0C1211;font-size:9px;font-weight:800;padding:1px 4px}
#panel{position:fixed;top:0;right:0;width:250px;height:100vh;background:#151F1D;border-left:2px solid #C9C1A8;padding:16px;box-sizing:border-box;display:flex;flex-direction:column;gap:10px}
#out{flex:1;background:#0C1211;border:2px solid #2E4642;color:#F3EEDD;font:500 12px/1.6 monospace;padding:8px;white-space:pre-wrap;overflow:auto}
button{background:#F2735A;color:#0C1211;border:0;padding:10px;font:800 13px system-ui;cursor:pointer}
</style></head><body>
<h1>Kenney Tiny Dungeon — full 132-tile picker</h1>
<p class="note"><b>Click any tile</b> to add it to your list on the right (click again to remove). Tagged tiles (mint badge) are currently in use and where. Write notes freely in the box, then copy the whole thing into chat and tell me what to change — e.g. "Hero Bronze should be r9c2 instead".</p>
<div class="grid">${cells}</div>
<div id="panel"><b>Your selection</b><div id="out">(click tiles…)</div><button id="cp">Copy to clipboard</button></div>
<script>
const sel=[];const out=document.getElementById('out');
function render(){const items=sel.length?sel.map(s=>s.ref+(s.note?' — '+s.note:'')).join('\\n'):'(click tiles…)';out.textContent=items;}
document.querySelectorAll('.cell').forEach(el=>el.addEventListener('click',()=>{
  const ref=el.dataset.ref;const i=sel.findIndex(s=>s.ref===ref);
  if(i>=0){sel.splice(i,1);el.classList.remove('sel');}
  else{sel.push({ref,note:''});el.classList.add('sel');}
  render();
}));
document.getElementById('cp').addEventListener('click',async()=>{
  const txt=sel.map(s=>s.ref).join(', ')||'(nothing selected)';
  try{await navigator.clipboard.writeText(txt);}catch(e){}
  alert('Copied: '+txt+'\\n\\nPaste into chat with your notes, plus what you want each tile used for.');
});
</script>
</body></html>`);
console.log('picker -> assets-raw/tile-picker.html (http://localhost:5511/assets-raw/tile-picker.html)');
