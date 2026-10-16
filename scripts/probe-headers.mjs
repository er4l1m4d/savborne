// which screens carry the wordmark header + what gap values exist
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const figs = c.split(/(?=<figure class="scr)/);
for (const f of figs) {
  const id = (f.match(/<figure class="scr" id="([^"]+)"/) || [])[1];
  if (!id) continue;
  const has = f.includes('aria-label="Savborne wordmark"');
  if (has) {
    const gap = (f.match(/align-items: center; gap: (\d+)px/) || [])[1];
    const wmSize = (f.match(/<svg width="(\d+)" height="(\d+)" viewBox="0 0 82 7"/) || []).slice(1, 3).join('x');
    console.log(`${id}  gap:${gap}  wm:${wmSize}`);
  }
}
console.log('--- header divs near wordmark:');
for (const m of c.matchAll(/<div style="display: flex; align-items: center; gap: \d+px">/g)) {
  console.log(m[0]);
}
