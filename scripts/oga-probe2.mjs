// OGA pages: author, attachments (relative or absolute), license text
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Safari/537.36' };
for (const u of ['https://opengameart.org/content/tiny-dungeon', 'https://opengameart.org/content/16x16-game-assets']) {
  const r = await fetch(u, { headers: UA });
  const t = await r.text();
  console.log('==== ' + u);
  console.log('h1: ' + (t.match(/<h1[^>]*>[\s\S]*?<\/h1>/i) || [''])[0].replace(/<[^>]+>/g, '').trim());
  console.log('by: ' + (t.match(/Submitted by[\s\S]{0,200}?>([^<]+)<\/a>/) || [])[1]);
  console.log('license text: ' + (t.match(/<(span|div|p)[^>]*field-name-field-license[\s\S]{0,300}/i) || ['', ''])[1] ? '' : '');
  const lics = [...t.matchAll(/(?:CC0|CC-BY(?:-SA)?|GPL|public domain|Creative Commons)[^<"]{0,60}/gi)].map(m => m[0].trim());
  console.log('licenses found: ' + [...new Set(lics)].slice(0, 6).join(' | '));
  const files = [...t.matchAll(/href="([^"]*\/(?:sites\/default\/files|system\/files)\/[^"]+\.(?:zip|tgz|tar\.gz|txt|png))"/gi)].map(m => m[1]);
  [...new Set(files)].forEach((f) => console.log('attachment: ' + f));
}
