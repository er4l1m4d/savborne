// Attempt to retrieve Kenney pack pages + download URLs (raw material, task 1)
const targets = [
  'https://kenney.nl/assets/rpg-icons',
  'https://kenney.nl/assets/game-icons',
  'https://kenney.nl/assets/pixel-platformer',
];
for (const url of targets) {
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', accept: 'text/html' } });
    const t = await r.text();
    console.log('=== ' + url + ' -> ' + r.status + ', ' + t.length + ' bytes');
    // find download/media links
    const links = [...t.matchAll(/href="([^"]*(?:download|media|\.zip)[^"]*)"/gi)].map(m => m[1]).slice(0, 8);
    console.log(links.join('\n') || '(no download links found)');
  } catch (e) {
    console.log('=== ' + url + ' ERROR: ' + e.message);
  }
}
