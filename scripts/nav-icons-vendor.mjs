// Write assets/nav-icons.json from Savborne-handoff.html.
// The asset is committed because the icons' source pack is gitignored.
import fs from 'node:fs'

import { extractNavIcons, TABS } from './nav-icons-extract.mjs'

const OUT = 'assets/nav-icons.json'

const { icons, bars } = extractNavIcons(fs.readFileSync('Savborne-handoff.html', 'utf8'))

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'Savborne-handoff.html',
      method: 'extracted by scripts/nav-icons-vendor.mjs',
      grid: '16x16 art (viewBox 0 0 16 16), rendered 24x24 with image-rendering pixelated',
      icons,
    },
    null,
    2
  ) + '\n'
)

const fills = (svg) =>
  [...new Set([...svg.matchAll(/fill="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]))].join(' ')

for (const tab of TABS) {
  console.log(`${tab.padEnd(10)} active:   ${fills(icons[tab].active)}`)
  if (icons[tab].active !== icons[tab].inactive) {
    console.log(`${''.padEnd(10)} inactive: ${fills(icons[tab].inactive)}`)
  }
}
console.log(`\nwrote ${OUT} from ${bars} nav bars`)
