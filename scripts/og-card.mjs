// Builds the 1200x630 link-preview card into public/og.png.
//
// This is the image people see *before* they open the app: every paste of
// savborne.vercel.app into X, Discord, Telegram or a submission README turns it
// into a card. 1200x630 is the 1.91:1 box those clients crop to, so the layout
// is authored at exactly that size and nothing is scaled or letterboxed.
//
// Drawn as HTML and screenshotted with the system Chromium, not composed with
// sharp, because the type has to be the real thing: the wordmark comes from
// assets/brand.json (vector paths, so it stays crisp) and the rest is set in the
// same vendored woff2 families the app ships. sharp renders SVG text with
// whatever fonts fontconfig exposes, which is not those.
//
// Re-run after changing the home screen so the card matches the live UI:
//   node scripts/og-card.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const run = promisify(execFile);

const W = 1200;
const H = 630;

const brand = JSON.parse(await readFile('assets/brand.json', 'utf8'));
const fontsDir = resolve('src/app/fonts');
const shot = resolve('docs/screenshots/home.png');

const fileUrl = (path) => `file://${path}`;

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Jakarta';
    src: url('${fileUrl(join(fontsDir, 'plus-jakarta-sans-latin-var.woff2'))}') format('woff2');
    font-weight: 200 800;
    font-style: normal;
  }
  @font-face {
    font-family: 'Silkscreen';
    src: url('${fileUrl(join(fontsDir, 'silkscreen-400-latin.woff2'))}') format('woff2');
    font-weight: 400;
    font-style: normal;
  }
  @font-face {
    font-family: 'Silkscreen';
    src: url('${fileUrl(join(fontsDir, 'silkscreen-700-latin.woff2'))}') format('woff2');
    font-weight: 700;
    font-style: normal;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: ${W}px;
    height: ${H}px;
    overflow: hidden;
  }

  body {
    background: #0C1211;
    font-family: 'Jakarta', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .card {
    position: relative;
    width: ${W}px;
    height: ${H}px;
    background:
      radial-gradient(circle at 79% 42%, rgba(111, 208, 174, 0.20), transparent 58%),
      #0C1211;
  }

  /* The faint pixel grid is the art direction's texture, not decoration added
     for this card: it is the same 24px cell the UI is built on. */
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(46, 70, 66, 0.55) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(46, 70, 66, 0.55) 1px, transparent 1px);
    background-size: 32px 32px;
    opacity: 0.45;
    mask-image: radial-gradient(circle at 30% 45%, #000 0%, transparent 75%);
    -webkit-mask-image: radial-gradient(circle at 30% 45%, #000 0%, transparent 75%);
  }

  .left {
    position: absolute;
    left: 80px;
    top: 74px;
    width: 640px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 22px;
  }

  .mark { display: block; }

  .tagline {
    margin-top: 48px;
    font-size: 62px;
    font-weight: 800;
    line-height: 1.08;
    letter-spacing: -0.025em;
    color: #F6EFD9;
  }

  .tagline .mint { color: #6FD0AE; }

  .sub {
    margin-top: 24px;
    max-width: 585px;
    font-size: 24px;
    font-weight: 500;
    line-height: 1.45;
    color: #A9B8B2;
  }

  .url-row {
    position: absolute;
    left: 80px;
    bottom: 62px;
    width: 640px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 22px;
    border-top: 1px solid #2E4642;
  }

  .url {
    font-family: 'Silkscreen', monospace;
    font-size: 21px;
    color: #6FD0AE;
  }

  .platform {
    font-family: 'Silkscreen', monospace;
    font-size: 13px;
    letter-spacing: 0.06em;
    color: #7A9187;
  }

  /* The phone bleeds off the bottom: it reads as a window onto a longer screen
     rather than a framed thumbnail, which is what the app actually is. */
  .phone {
    position: absolute;
    left: 782px;
    top: 44px;
    width: 351px;
    border-radius: 28px;
    overflow: hidden;
    box-shadow:
      0 0 0 3px #2E4642,
      0 0 0 6px #101A18,
      0 40px 90px rgba(0, 0, 0, 0.65);
  }

  .phone img {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="grid"></div>

    <div class="left">
      <div class="brand">
        <svg class="mark" width="86" height="86" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${brand.logo.paths}</svg>
        <svg class="mark" width="470" height="40" viewBox="0 0 82 7" xmlns="http://www.w3.org/2000/svg">${brand.wordmark.paths}</svg>
      </div>

      <h1 class="tagline">Save for real.<br><span class="mint">Level up for fun.</span></h1>

      <p class="sub">
        A non-custodial NIM vault with a game layer. Check in daily and turn your
        real on-chain balance into XP, streaks, items and rank.
      </p>
    </div>

    <div class="url-row">
      <span class="url">savborne.vercel.app</span>
      <span class="platform">NIMIQ PAY MINI APP</span>
    </div>

    <div class="phone">
      <img src="${fileUrl(shot)}" alt="">
    </div>
  </div>
</body>
</html>`;

const work = join(tmpdir(), 'savborne-og');
await mkdir(work, { recursive: true });
await mkdir('public', { recursive: true });

const page = join(work, 'card.html');
await writeFile(page, html);

const out = resolve('public/og.png');

await run('chromium', [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=1',
  `--window-size=${W},${H}`,
  // Fonts load over file://, and --screenshot fires on load, so give the
  // renderer a fixed budget instead of racing the woff2 fetch.
  '--virtual-time-budget=4000',
  `--screenshot=${out}`,
  fileUrl(page),
]);

const png = await readFile(out);
console.log(`public/og.png ${W}x${H} ${Math.round(png.length / 1024)} KB`);
