// Dump all distinct stroke-icons and sprite blocks in the handoff for mapping
import fs from 'node:fs';
const c = fs.readFileSync('Savborne-handoff.html', 'utf8');

const m = new Map();
for (const x of c.matchAll(/<svg\b[\s\S]*?<\/svg>/g)) {
  const tag = x[0];
  if (tag.includes('stroke="currentColor"')) {
    const d = (tag.match(/<path d="([^"]*)"/) || [])[1] || 'CIRCLE';
    const label = (tag.match(/aria-label="([^"]*)"/) || [])[1] || '';
    const key = d + ' ## ' + label;
    m.set(key, (m.get(key) || 0) + 1);
  }
}
console.log('--- stroke icons ---');
for (const [k, n] of m) console.log(`${n}x  ${k.slice(0, 110)}`);

const spr = [...c.matchAll(/<svg class="spr" viewBox="([^"]*)"[^>]*>/g)];
console.log('\n--- sprite svgs: ' + spr.length + ', viewBoxes: ' + [...new Set(spr.map(s => s[1]))].join(','));

// context of each sprite: the parent div's role/aria + size
for (const mm of c.matchAll(/<div role="img" aria-label="([^"]*)" style="([^"]*)"/g)) {
  console.log('SPRITE CTX: ' + mm[1] + '  ||  ' + mm[2].slice(0, 80));
}
