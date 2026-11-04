// Drift check for assets/nav-icons.json.
//
// Re-extracts the nav icons from Savborne-handoff.html in memory and compares them
// to the committed asset. Exits non-zero on any difference, the same role
// scripts/glyph-provenance.mjs plays for the action glyphs.
import fs from 'node:fs'

import { extractNavIcons, TABS } from './nav-icons-extract.mjs'

const OUT = 'assets/nav-icons.json'

if (!fs.existsSync(OUT)) {
  console.error(`${OUT} is missing — run scripts/nav-icons-vendor.mjs`)
  process.exit(1)
}

const shipped = JSON.parse(fs.readFileSync(OUT, 'utf8'))
const { icons } = extractNavIcons(fs.readFileSync('Savborne-handoff.html', 'utf8'))

let fail = 0

for (const tab of TABS) {
  for (const state of ['active', 'inactive']) {
    const want = icons[tab][state]
    const got = shipped.icons?.[tab]?.[state]
    const ok = got === want
    if (!ok) fail++
    console.log(`${tab.padEnd(10)} ${state.padEnd(9)} ${ok ? 'OK' : '*** DRIFT ***'}`)
  }
}

const extra = Object.keys(shipped.icons ?? {}).filter((k) => !TABS.includes(k))
if (extra.length) {
  console.log(`unexpected tabs in the asset: ${extra.join(', ')}`)
  fail++
}

console.log(`\n${TABS.length} tabs, ${TABS.length * 2} states verified, ${fail} drift`)
process.exit(fail ? 1 : 0)
