// WCAG 2.2 contrast calculator for Savborne tokens (no dependencies)
const L = (hex) => {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [l1, l2] = [L(a), L(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};
const T = {
  ground: '#0C1211', surface: '#151F1D', inset: '#101A18', track: '#243532',
  line: '#C9C1A8', edge: '#2E4642', text: '#F3EEDD', muted: '#A9B8B2',
  mint: '#6FD0AE', coral: '#F2735A', coralEdge: '#A8452F', coralText: '#FF9C86',
  warnFill: '#2A1B18', off: '#4B5A56', forest: '#0C3B35', cream: '#F6EFD9', ember: '#FF6A4D',
};
const pairs = [
  // claimed in doc
  ['text', 'ground', 4.5, 'body text'],
  ['muted', 'surface', 4.5, 'secondary text'],
  ['mint', 'surface', 4.5, 'progress/success text'],
  ['ground', 'coral', 4.5, 'CTA label on coral'],
  ['ground', 'mint', 4.5, 'chip label on mint fill'],
  ['coralText', 'warnFill', 4.5, 'banner text'],
  // unclaimed pairs the screens actually use
  ['muted', 'ground', 4.5, 'nav labels, body on app bg'],
  ['mint', 'ground', 4.5, 'links, active nav on ground'],
  ['coralText', 'surface', 4.5, 'coral text on panels'],
  ['text', 'surface', 4.5, 'text on cards'],
  ['text', 'inset', 4.5, 'text on arena/inset'],
  ['muted', 'inset', 4.5, 'disabled btn text'],
  ['text', 'warnFill', 4.5, 'text in banner'],
  ['ground', 'coralEdge', 4.5, 'label if ever on edge'],
  // non-text, 3:1 minimum
  ['line', 'ground', 3, 'panel outline vs app bg'],
  ['line', 'surface', 3, 'outline vs panel'],
  ['edge', 'ground', 3, 'hard shadow vs bg'],
  ['off', 'inset', 3, 'disabled outline vs fill'],
  ['track', 'inset', 3, 'HP track vs arena'],
  ['track', 'surface', 3, 'HP track vs panel'],
  ['mint', 'track', 3, 'XP fill vs bar track(bg=ground)'],
  ['mint', 'ground', 3, 'XP fill vs its track'],
  ['coral', 'track', 3, 'foe HP fill vs track'],
  ['coral', 'ground', 3, 'fill vs track'],
  ['warnFill', 'surface', 3, 'banner fill vs panel'],
  ['coral', 'surface', 3, 'banner border vs panel'],
];
let fails = 0;
for (const [fg, bg, min, note] of pairs) {
  const r = ratio(T[fg], T[bg]);
  const ok = r >= min;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${r.toFixed(2).padStart(5)} :1  (need ${min})  ${fg} on ${bg}  — ${note}`);
}
console.log(`\n${fails} failing pair(s) of ${pairs.length}`);
