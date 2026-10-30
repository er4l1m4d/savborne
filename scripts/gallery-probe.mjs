// Print the sprite-gallery intro + the first gallery card, and every <code> label in the
// gallery, so the shipper rewrites real markup rather than assumed markup.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const i = h.indexOf('reference pose');
console.log('--- intro region ---');
console.log(h.slice(i - 900, i + 200));
console.log('\n--- gallery <code> labels, in order ---');
const start = h.indexOf('<div class="cards">', i);
const end = h.indexOf('</div>\n\n', start) > -1 ? h.indexOf('</div>\n\n', start) : start + 12000;
const slice = h.slice(start, start + 14000);
console.log([...slice.matchAll(/<code>([^<]*)<\/code>/g)].map((m) => m[1]).join(' | '));
console.log('\n--- first gallery card, raw ---');
const first = slice.indexOf('<div class="card"');
const second = slice.indexOf('<div class="card"', first + 10);
console.log(slice.slice(first, second).replace(/(<path[^>]*>)/g, '<path…>').slice(0, 900));
console.log('\n--- what follows the last gallery card ---');
const tailIdx = h.indexOf('Rival · default');
console.log(h.slice(tailIdx - 60, tailIdx + 700).replace(/(<path[^>]*>)/g, '<path…>'));

// Boundary: where does the sprite gallery end, and what heading comes next?
const cardsAt = h.indexOf('<div class="cards">', start);
const nextH3 = h.indexOf('<h3>', cardsAt);
const nextH2 = h.indexOf('<h2', cardsAt);
const stop = nextH3 > -1 && (nextH3 < nextH2 || nextH2 === -1) ? nextH3 : nextH2;
const trim = (s) => s.replace(/d="[0-9Mh vz]{40,}"/g, 'd="LONGPATH"');
console.log('\n--- boundary: cards at', cardsAt, 'next h3', nextH3, 'next h2', nextH2, 'stop', stop);
console.log('TAIL:\n' + trim(h.slice(stop - 700, stop)));
console.log('NEXT:\n' + trim(h.slice(stop, stop + 260)));
