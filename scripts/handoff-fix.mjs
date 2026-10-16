// One-shot real-time fixes to Savborne-handoff.html (Pass A + B, round 1)
import fs from 'node:fs';
const F = 'Savborne-handoff.html';
let h = fs.readFileSync(F, 'utf8');
const log = [];

// 1. viewport-fit=cover (doc must practice its own platform rule)
if (h.includes('initial-scale=1"')) {
  h = h.replace('content="width=device-width,initial-scale=1"',
                'content="width=device-width,initial-scale=1,viewport-fit=cover"');
  log.push('meta viewport: +viewport-fit=cover');
}

// 2. nav buttons -> anchors with real hrefs
const NAV = { Home: '/home', Missions: '/missions', Battle: '/battle', Ranks: '/ranks', Profile: '/profile' };
let navCount = 0;
h = h.replace(/<button type="button"( aria-current="page")? style="flex: 1; min-height: 56px;(?:[^"]*)">(.*?)<\/button>/gs,
  (m, cur, inner) => {
    const label = (inner.match(/(Home|Missions|Battle|Ranks|Profile)$/) || [])[1];
    if (!label) return m;
    navCount++;
    const style = m.match(/style="([^"]*)"/)[1].replace(/"$/, '') + '; text-decoration: none';
    const ac = cur ? ' aria-current="page"' : '';
    return `<a href="${NAV[label]}"${ac} style="${style}">${inner}</a>`;
  });
log.push(`nav buttons -> anchors: ${navCount}`);

// 3. HP/value bars: invisible track -> line-bordered ground track (1.4.11)
const barOld = 'height: 10px; background: #243532';
const barNew = 'height: 14px; box-sizing: border-box; border: 2px solid #C9C1A8; background: #0C1211';
let barCount = 0;
while (h.includes(barOld)) { h = h.replace(barOld, barNew); barCount++; }
h = h.replace('style="height:10px;background:var(--sv-track)"', 'style="height:14px;background:var(--sv-ground)"');
log.push(`hardcoded bars re-bordered: ${barCount} (+1 demo)`);

// 4. .sv-bar--hp CSS contract (code block)
h = h.replace('.sv-bar--hp{height:10px;border:0;background:var(--sv-track)}',
              '.sv-bar--hp{height:14px;border:2px solid var(--sv-line);background:var(--sv-ground)}');

// 5. switch off-state border: off (2.4:1) -> muted (8.2:1)
h = h.split('.sv-switch{position:relative;width:52px;height:28px;border:2px solid var(--sv-off);background:var(--sv-inset)}')
     .join('.sv-switch{position:relative;width:52px;height:28px;border:2px solid var(--sv-muted);background:var(--sv-inset)}');
log.push('switch border off->muted');

// 6. sv-dots: content animation is Chromium-only -> width reveal, works everywhere
h = h.replace("@keyframes sv-dots{0%{content:''}25%{content:'.'}50%{content:'..'}75%{content:'...'}}",
              '@keyframes sv-dots{0%{width:0}100%{width:3.2ch}}');
h = h.replace("@keyframes sv-dots{0%{content:&#x27;&#x27;}25%{content:&#x27;.&#x27;}50%{content:&#x27;..&#x27;}75%{content:&#x27;...&#x27;}}",
              '@keyframes sv-dots{0%{width:0}100%{width:3.2ch}}');
h = h.replace(".sv-dots::after{content:'';animation:sv-dots 1.2s steps(4) infinite}",
              ".sv-dots::after{content:'...';display:inline-block;width:3.2ch;overflow:hidden;vertical-align:bottom;animation:sv-dots 1.2s steps(4) infinite}");
h = h.replace(".sv-dots::after{content:&#x27;&#x27;;animation:sv-dots 1.2s steps(4) infinite}",
              ".sv-dots::after{content:&#x27;...&#x27;;display:inline-block;width:3.2ch;overflow:hidden;vertical-align:bottom;animation:sv-dots 1.2s steps(4) infinite}");
log.push('sv-dots cross-browser fix (head + code block)');

// 7. focus-visible: the prose promised it; the CSS never had it
const focusCss = '.sv-btn__face:focus-visible,.sv-icon-btn:focus-visible,.sv-nav a:focus-visible,.sv-switch:focus-visible,.sv-row a:focus-visible,a:focus-visible{outline:2px solid var(--sv-mint);outline-offset:2px}';
h = h.replace('.sv-btn__face{width:100%;height:64px;border:0;font:800 18px var(--sv-font-ui);cursor:pointer;background:var(--sv-coral);color:var(--sv-ground)}',
              '.sv-btn__face{width:100%;height:64px;border:0;font:800 18px var(--sv-font-ui);cursor:pointer;background:var(--sv-coral);color:var(--sv-ground)}\n' + focusCss);
h = h.replace('.sv-btn:active:not(:has(:disabled)){transform:translateY(4px);filter:none}   /* press: sink into the hard shadow */',
              '.sv-btn:active:not(:has(:disabled)){transform:translateY(4px);filter:none}   /* press: sink into the hard shadow */\n' + focusCss);
log.push('focus-visible rules added (head + Component CSS)');

// 8. updated contrast claims in Colors prose (all re-verified by script)
h = h.replace('Checked contrasts: text/ground 16.3, muted/surface 8.2, mint/surface 9.1, ground/coral 6.6, ground/mint 10.2, coral-text/warn-fill 8.2.',
  'Checked contrasts: text/ground 16.3, muted/surface 8.2, mint/surface 9.1, ground/coral 6.6, ground/mint 10.2, coral-text/warn-fill 8.2, muted/ground 9.2, mint/ground 10.2, coral-text/surface 8.3, text/surface 14.5, line/ground 10.5, line/surface 9.4. Disabled controls (off colors) are exempt under WCAG; <code>track</code> is decorative only — every value-bearing bar carries a <code>line</code> outline so its bounds read at 10.5:1.');
log.push('contrast paragraph updated');

// 9. HP bar spec row
h = h.replace('<tr><td>HP bar</td><td>10px, track #243532. Mint = you, coral = opponent</td><td>default, damage</td></tr>',
              '<tr><td>HP bar</td><td>14px, 2px line border, ground track (same as XP bar). Mint = you, coral = opponent — HP number text always sits adjacent, color is never the only signal</td><td>default, damage</td></tr>');
log.push('HP bar table row updated');

fs.writeFileSync(F, h);
console.log(log.join('\n'));
