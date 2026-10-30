// Inspection before shipping the turn-signal treatment: what does each arena's nameplate
// and sprite markup actually look like, and can a script tell which side is acting?
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const marks = [...h.matchAll(/id="(A_[A-Za-z]+)"/g)];
const secs = marks.map((m, i) => ({ id: m[1], from: m.index, to: i + 1 < marks.length ? marks[i + 1].index : h.length }));
const TARGET = ['A_ItemSheet', 'A_Battle', 'A_InBattleWait', 'A_Win', 'A_Loss', 'A_Tie', 'A_ConnLost'];

for (const s of secs) {
  if (!TARGET.includes(s.id)) continue;
  const body = h.slice(s.from, s.to);
  const tags = [...body.matchAll(/>(YOUR MOVE|THEIRS|ACTED|OFFLINE|YOUR TURN|WAITING)</g)].map((m) => m[1]);
  const plates = [...body.matchAll(/border: 2px (solid|dashed) (#\w{6})/g)].map((m) => `${m[1]} ${m[2]}`);
  const spr = [...body.matchAll(/class="spr"/g)].length;
  const anims = [...body.matchAll(/animation:\s*([^;"]+)/g)].map((m) => m[1].trim());
  const opac = [...body.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => m[1]);
  console.log(`${s.id.padEnd(16)} tags=[${tags.join(', ')}] plateBorders=[${plates.join(' | ')}] spr=${spr} anim=[${anims.join(', ')}] opacity=[${opac.join(', ')}]`);
}
console.log('\n--- one full nameplate from A_Battle, to see the markup a ship script must edit ---');
const ab = secs.find((s) => s.id === 'A_Battle');
const body = h.slice(ab.from, ab.to);
const i = body.indexOf('YOUR MOVE') >= 0 ? body.lastIndexOf('<div', body.indexOf('YOUR MOVE') - 400) : 0;
console.log(body.slice(i, i + 1500).replace(/\s+/g, ' '));
