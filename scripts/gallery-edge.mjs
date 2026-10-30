// Boundary check: what sits between the character-sprite gallery and the next heading,
// so the shipper replaces a clean range and nothing adjacent gets swallowed.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const start = h.indexOf('<h3>Character sprites</h3>');
const cards = h.indexOf('<div class="cards">', start);
const nextH3 = h.indexOf('<h3>', cards);
const nextH2 = h.indexOf('<h2', cards);
console.log('cards open at', cards, '| next h3 at', nextH3, '| next h2 at', nextH2);
const stop = nextH3 > -1 && nextH3 < nextH2 ? nextH3 : nextH2;
console.log('\n--- 900 chars before the next heading (tail of the gallery) ---');
console.log(h.slice(stop - 900, stop).replace(/d="[0-9Mh vz]{40,}"/g, 'd="…"'));
console.log('\n--- the next heading plus 300 chars ---');
console.log(h.slice(stop, stop + 300).replace(/d="[0-9Mh vz]{40,}"/g, 'd="…"'));
