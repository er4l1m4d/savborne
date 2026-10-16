// Source Kenney packs via OpenGameArt direct-file mirrors; also verify the two slug corrections
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36' };
const pages = [
  'https://opengameart.org/content/tiny-dungeon',
  'https://opengameart.org/content/kenney-game-assets',
  'https://opengameart.org/content/16x16-game-assets',
];
for (const u of pages) {
  try {
    const r = await fetch(u, { headers: UA });
    const t = await r.text();
    console.log('=== ' + r.status + ' ' + u);
    if (r.status !== 200) continue;
    const title = (t.match(/<h1[^>]*>([^<]*)</i) || [])[1];
    console.log('title: ' + (title || '').trim());
    const author = (t.match(/"name":\s*"([^"]+)"/) || t.match(/Submitted by[^<]*<a[^>]*>([^<]+)/) || [])[1];
    console.log('author hint: ' + (author || 'n/a'));
    const files = [...t.matchAll(/https?:\/\/[^"'\s]+opengameart[^"'\s]*\/sites\/default\/files\/[^"'\s]+/gi)].map(m => m[0]);
    [...new Set(files)].slice(0, 10).forEach((f) => console.log('file: ' + f));
    const lic = (t.match(/License[^<]*<\/[ah]>|Creative Commons[^<]{0,40}|CC0[^<]{0,20}|GPL[^<]{0,20}|CC-BY[^<]{0,10}/i) || [])[0];
    console.log('license: ' + (lic || 'unknown'));
  } catch (e) { console.log('ERR ' + u + ' ' + e.message); }
}
