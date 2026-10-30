// Dump the arena block of one battle mock verbatim so the ship script edits real markup.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const start = h.indexOf('id="A_Battle"');
const seg = h.slice(start, start + 4200);
// show it with tags on their own lines for readability
console.log(seg.replace(/></g, '>\n<').split('\n').map((l, i) => String(i).padStart(3) + ' ' + l).join('\n'));
