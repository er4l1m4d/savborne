// Header fixes round 2c: error screens carry gap+height variant pattern
import fs from 'node:fs';
let c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const figs = c.split(/(?=<figure class="scr)/);
const log = [];
for (let i = 0; i < figs.length; i++) {
  const f = figs[i];
  const id = (f.match(/<figure class="scr" id="([^"]+)"/) || [])[1];
  if (id !== 'A_UpdatePay' && id !== 'A_BalanceError') continue;
  const title = id === 'A_UpdatePay' ? 'Update Nimiq Pay' : 'Couldn\u2019t read balance';
  const re = /<div style="display: flex; align-items: center; gap: 10px; height: 44px">[\s\S]*?aria-label="Savborne wordmark"[\s\S]*?<\/svg>\n<\/div>/;
  if (!re.test(f)) { log.push(id + ' still missing'); continue; }
  figs[i] = f.replace(re,
    `<span style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.02em; display: flex; align-items: center; height: 36px">${title}</span>`);
  log.push(id + ' -> slim title header');
}
fs.writeFileSync('Savborne-handoff.html', figs.join(''));
console.log(log.join('\n'));
