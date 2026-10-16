// Header fixes round 2b: restore Welcome brand wordmark; contextual titles on error screens
import fs from 'node:fs';
let c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const log = [];
const figs = c.split(/(?=<figure class="scr)/);
for (let i = 0; i < figs.length; i++) {
  const f = figs[i];
  const id = (f.match(/<figure class="scr" id="([^"]+)"/) || [])[1];
  if (!id) continue;
  if (id === 'A_Welcome') {
    const n = f.split('width="116" height="10" viewBox="0 0 82 7"').join('width="164" height="14" viewBox="0 0 82 7"');
    if (n !== f) { figs[i] = n; log.push('Welcome wordmark restored to 164x14'); }
  }
  if (id === 'A_UpdatePay' || id === 'A_BalanceError') {
    const title = id === 'A_UpdatePay' ? 'Update Nimiq Pay' : 'Couldn\u2019t read balance';
    const n = f.replace(
      /<div style="display: flex; align-items: center; gap: 10px">[\s\S]*?aria-label="Savborne wordmark"[\s\S]*?<\/svg>\n<\/div>/,
      `<span style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 800; font-size: 22px; letter-spacing: -0.02em">${title}</span>`
    );
    if (n !== f) { figs[i] = n; log.push(id + ' -> slim title header'); }
    else log.push(id + ' PATTERN MISS');
  }
}
c = figs.join('');
fs.writeFileSync('Savborne-handoff.html', c);
console.log(log.join('\n'));
