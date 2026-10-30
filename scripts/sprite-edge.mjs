// Boundary check for the character-sprite gallery range.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');
const start = h.indexOf('<h3>Character sprites</h3>');
const cards = h.indexOf('<div class="cards">', start);
const nextH3 = h.indexOf('<h3>', cards);
const nextH2 = h.indexOf('<h2', cards);
const stop = nextH3 > -1 && nextH3 < nextH2 ? nextH3 : nextH2;
const trim = (s) => s.replace(/d="[0-9Mh vz]{40,}"/g, 'd="LONGPATH"');
console.log('cards at', cards, 'next h3', nextH3, 'next h2', nextH2, 'stop', stop);
console.log('TAIL:\n' + trim(h.slice(stop - 900, stop)));
console.log('NEXT:\n' + trim(h.slice(stop, stop + 300)));
