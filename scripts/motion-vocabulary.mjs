// Extract the handoff's ACTUAL motion vocabulary: every @keyframes with its real steps and
// durations, every timing token, and the demo sequences. Section 6 must be written from
// this, not from a scratch preview.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');

console.log('=== @keyframes, verbatim ===');
for (const m of h.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?)\}\s*\}/g)) {
  console.log(`  ${m[1]}: ${m[2].replace(/\s+/g, ' ').trim()}`);
}

console.log('\n=== timing tokens (--sv-t-*, --sv-ease) ===');
for (const m of h.matchAll(/--sv-(t-[\w-]+|ease)\s*:\s*([^;]+);/g)) {
  console.log(`  --sv-${m[1]}: ${m[2].trim()}`);
}

console.log('\n=== classes that reference animation/transition ===');
for (const m of h.matchAll(/\.(sv-[\w-]+)\s*\{[^}]*(?:animation|transition)\s*:\s*([^;}]+)/g)) {
  console.log(`  .${m[1]} -> ${m[2].trim()}`);
}

console.log('\n=== the battle demo, verbatim ===');
const d = h.indexOf('function demo3');
console.log(h.slice(d, h.indexOf('}', h.indexOf('setTimeout', h.indexOf('sv-hit'))) + 60).replace(/\s+/g, ' '));

console.log('\n=== does any CSS media query handle reduced motion? ===');
console.log(/@media[^{]*prefers-reduced-motion/.test(h) ? 'YES' : 'NO — reduce is JS-only via matchMedia');

console.log('\n=== is there a glow / rim animation at all? ===');
console.log(/glow|rim|sv-glow/i.test(h) ? 'found' : 'NO — the glow channel has no implementation in the doc');

console.log('\n=== nameplate border / tag markup the demo could drive ===');
console.log(`  plates with border: 4px solid #C9C1A8 -> ${(h.match(/border: 4px solid #C9C1A8/g) || []).length}`);
console.log(`  plates with 2px solid #5A6988        -> ${(h.match(/2px (solid|dashed) #5A6988/g) || []).length}`);
console.log(`  opacity: 0.62                        -> ${(h.match(/opacity: 0\.62/g) || []).length}`);
