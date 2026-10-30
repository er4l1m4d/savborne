// Find the fighter sprites inside the three arenas that have nameplates. They are not
// .spr wrappers, so match on large 16x16 viewBox svgs and report their wrapper.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const marks = [...h.matchAll(/id="(A_[A-Za-z]+)"/g)];
const secs = marks.map((m, i) => ({ id: m[1], from: m.index, to: i + 1 < marks.length ? marks[i + 1].index : h.length }));

for (const s of secs.filter((x) => ['A_Battle', 'A_InBattleWait', 'A_ConnLost'].includes(x.id))) {
  const body = h.slice(s.from, s.to);
  console.log(`\n=== ${s.id} ===`);
  for (const m of body.matchAll(/<svg width="(\d+)" height="\1" viewBox="0 0 16 16"/g)) {
    const size = Number(m[1]);
    if (size < 40) continue;                       // skip icons
    // walk back to the nearest positioned wrapper
    const back = body.slice(Math.max(0, m.index - 260), m.index);
    const wrap = back.lastIndexOf('<div');
    console.log(`  sprite ${size}x${size} @${s.from + m.index}`);
    console.log(`    wrapper: ${body.slice(wrap >= 0 ? wrap : 0, m.index).replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  // and the plate interiors, to see what text sits in them
  for (const p of body.matchAll(/<div style="position: absolute; (left|right): 14px;[^"]*border: 2px solid #C9C1A8[^"]*">([\s\S]{0,700}?)<\/div>\s*<\/div>/g)) {
    const txt = (p[2].match(/>([A-Za-z][^<>]{1,22})</g) || []).map((x) => x.slice(1, -1));
    console.log(`  plate ${p[1]}: texts=[${txt.join(' | ')}]`);
  }
}
