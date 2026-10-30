// Three candidate treatments for "whose turn is it", measured rather than argued.
// The current one fails: a 2px mint border against a 2px cream border is a 1.35:1 hue
// difference, and the plate's own HP bar is ALSO mint, so the turn signal competes with a
// louder shape in the same colour.
import fs from 'node:fs';
const MINT = '#6FD0AE', EDGE = '#C9C1A8', PLATE = '#151F1D';
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

console.log('the two problems with the current treatment');
console.log(`  lit border ${MINT} vs neutral border ${EDGE}: ${ratio(MINT, EDGE).toFixed(2)}:1  <- the entire turn signal`);
console.log(`  lit border ${MINT} vs HP bar ${MINT}: identical colour, and the HP bar is a 140x10 block against a 2px line`);
console.log(`  neutral border ${EDGE} vs plate ${PLATE}: ${ratio(EDGE, PLATE).toFixed(2)}:1`);
console.log();

// Candidate B: width as well as colour. Shape difference survives grayscale and does not
// compete with the HP bar, because the HP bar cannot be 5px thick.
console.log('candidate B — acting plate border 2px -> 5px, same mint');
console.log(`  area of border paint, neutral: ${2 * 2 * (168 + 85)} px   acting: ${5 * 2 * (168 + 85)} px   = ${(5 / 2).toFixed(1)}x more paint`);

// Candidate C: dim the NON-acting plate. Luminance is the most pre-attentive channel we have
// and this uses none of the colours the HP bar already owns.
const dim = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
const dimBorder = dim(EDGE, 0.42), dimPlate = dim(PLATE, 0.6);
console.log();
console.log('candidate C — the NON-acting plate dims: border and interior both');
console.log(`  acting border ${EDGE} vs dimmed border ${dimBorder}: ${ratio(EDGE, dimBorder).toFixed(2)}:1`);
console.log(`  acting interior ${PLATE} vs dimmed interior ${dimPlate}: ${ratio(PLATE, dimPlate).toFixed(2)}:1`);
console.log(`  for reference, the bob: 2px on a 104px sprite = ${(2 / 104 * 100).toFixed(1)}% of its height`);

// Candidate D: combine B and C, and move the lit colour off mint so it stops colliding with HP
const litAccent = '#FEE761';
console.log();
console.log('candidate D — dim the inactive plate AND mark the active one with a colour the HP bar never uses');
console.log(`  gilt ${litAccent} vs cream ${EDGE}: ${ratio(litAccent, EDGE).toFixed(2)}:1`);
console.log(`  gilt ${litAccent} vs mint HP ${MINT}: ${ratio(litAccent, MINT).toFixed(2)}:1`);
console.log(`  BUT gilt is the earned-badge ramp colour and #FEE761 is already spoken for in the pack census`);
