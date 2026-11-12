// Builds the competition submission media into docs/submission-assets/.
// The thumbnail is drawn from assets/brand.json, not a font, so the pixel
// wordmark stays crisp at 240x240.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const brand = JSON.parse(await readFile('assets/brand.json', 'utf8'));
const OUT = 'docs/submission-assets';
const BG = '#0C3B35';

const logo = brand.logo;
const wordmark = brand.wordmark;

function svg({ size, bg = BG, chestScale, wordmarkScale, gap, dy = 0 }) {
  // The chest occupies x 7-17, y 6-18 inside the 24x24 logo viewBox; scale to
  // the art's bounds so the mark fills the tile instead of its padding.
  const art = { x: 7, y: 6, w: 10, h: 12 };
  const logoW = art.w * chestScale;
  const logoH = art.h * chestScale;
  const markW = 82 * wordmarkScale;
  const markH = 7 * wordmarkScale;
  const total = logoH + gap + markH;
  const top = Math.round((size - total) / 2) + dy;
  const logoX = Math.round((size - logoW) / 2);
  const markX = Math.round((size - markW) / 2);
  const markY = top + logoH + gap;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}"/>
  <g transform="translate(${logoX - art.x * chestScale} ${top - art.y * chestScale}) scale(${chestScale})">${logo.paths}</g>
  <g transform="translate(${markX} ${markY}) scale(${wordmarkScale})">${wordmark.paths}</g>
</svg>`);
}

async function render(name, size, opts) {
  const png = await sharp(svg({ size, ...opts })).png().toBuffer();
  await writeFile(`${OUT}/${name}`, png);
  return `${name} ${size}x${size}`;
}

await mkdir(OUT, { recursive: true });

// App icon: already authored at 512, flattened onto the brand green so no
// checkerboard shows if the form renders it on a light card.
await sharp('src/app/icon.png')
  .flatten({ background: BG })
  .resize(512, 512)
  .png()
  .toFile(`${OUT}/app-icon-512.png`);

console.log(await render('thumbnail-240.png', 240, { chestScale: 12, wordmarkScale: 2, gap: 16 }));
console.log(await render('thumbnail-240-alt.png', 240, { chestScale: 14, wordmarkScale: 2, gap: 12 }));

for (const shot of ['home', 'vault', 'missions', 'ranks', 'battle']) {
  await sharp(`docs/screenshots/${shot}.png`)
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/screenshot-${shot}.png`);
  console.log(`screenshot-${shot}.png`);
}
