// Measure the arena's sprite/shadow geometry on every battle-family screen, and the tie
// case, so the brief can state facts instead of impressions.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');

for (const id of ['A_Battle', 'A_InBattleWait', 'A_Win', 'A_Loss', 'A_Tie', 'A_ConnLost']) {
  const a = h.indexOf(`id="${id}"`);
  if (a < 0) { console.log(`${id}: not found`); continue; }
  const b = h.indexOf('id="A_', a + 8);
  const region = h.slice(a, b < 0 ? a + 6000 : b);
  console.log(`\n${id}`);
  // every absolutely-positioned box in the arena, with what it is
  for (const m of region.matchAll(/<div ([^>]*position: absolute[^>]*)>([\s\S]{0,120})/g)) {
    const at = m[1], inner = m[2];
    const label = (at.match(/aria-label="([^"]*)"/) || [, ''])[1];
    const w = (at.match(/width:\s*([\d.]+)px/) || [, '?'])[1];
    const hh = (at.match(/height:\s*([\d.]+)px/) || [, '?'])[1];
    const bottom = (at.match(/bottom:\s*([\d.]+)px/) || [, ''])[1];
    const top = (at.match(/top:\s*([\d.]+)px/) || [, ''])[1];
    const bg = (at.match(/background:\s*([^;"]+)/) || [, ''])[1];
    const op = (at.match(/opacity:\s*([\d.]+)/) || [, ''])[1];
    const kind = /rgba\(0,0,0/.test(bg) ? 'SHADOW PILL' : inner.includes('class="spr"') ? 'SPRITE' : 'other';
    if (kind === 'other' && !label) continue;
    console.log(`  ${kind.padEnd(12)} ${String(w).padStart(5)}x${String(hh).padEnd(5)} top=${top || '-'} bottom=${bottom || '-'} ${op ? 'opacity ' + op : ''} ${bg.startsWith('rgba') ? '' : bg} ${label ? '"' + label + '"' : ''}`);
  }
}
