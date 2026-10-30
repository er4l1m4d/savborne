// Show the handoff's existing motion demo verbatim. Found after the fact: arena-plates.mjs
// reported anim=[] because it only looked for inline `animation:` styles and missed a
// JS-driven class replay. Any spec that contradicts working demo code in the doc is wrong.
import fs from 'node:fs';
const h = fs.readFileSync('Savborne-handoff.html', 'utf8');

const at = h.indexOf('function replay');
const from = at >= 0 ? at : h.indexOf('sv-lunge');
console.log('--- around the demo script ---');
console.log(h.slice(Math.max(0, from - 1400), from + 1800));

console.log('\n--- all sv-* keyframe / class names present ---');
console.log([...new Set([...h.matchAll(/sv-[a-z-]+/g)].map((m) => m[0]))].join(', '));
console.log('\n--- @keyframes defined ---');
console.log([...new Set([...h.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]))].join(', '));
console.log('\n--- prefers-reduced-motion handling ---');
for (const m of h.matchAll(/.{160}prefers-reduced-motion.{160}/g)) console.log('  ' + m[0].replace(/\s+/g, ' '));
