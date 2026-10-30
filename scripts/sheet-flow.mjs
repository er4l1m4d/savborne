// Dump ItemSheet text flow with item-icon placeholders inline
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');
const i = c.indexOf('id="A_ItemSheet"');
const j = c.indexOf('</figure>', i);
let seg = c.slice(i, j);
seg = seg.replace(/<svg width="36" height="36" viewBox="0 0 8 8"[\s\S]*?<\/svg>/g, '<<ICON8>>');
const txt = seg.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log(txt.slice(0, 700));
