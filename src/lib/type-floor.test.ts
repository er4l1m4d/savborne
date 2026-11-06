import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../', import.meta.url))

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

/** Files still waiting for their migration commit. This list must be empty at the end. */
const PENDING = new Set([
  'app/battle/[id]/page.tsx',
  'app/setup/page.tsx',
  'app/card/[token]/page.tsx',
  'components/vault/PhraseCeremony.tsx',
])

function violations() {
  const out: { file: string; line: number; text: string }[] = []
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length).replaceAll('\\', '/')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((text, i) => {
      if (/text-\[(?:10|11)px\]/.test(text) && !text.includes('sv-state')) {
        out.push({ file: rel, line: i + 1, text: text.trim() })
      }
    })
  }
  return out
}

test('no text below 12px outside .sv-state', () => {
  const bad = violations().filter((v) => !PENDING.has(v.file))
  assert.equal(
    bad.length,
    0,
    bad.map((v) => `${v.file}:${v.line} ${v.text}`).join('\n'),
  )
})

test('every PENDING file still needs its entry', () => {
  const files = new Set(violations().map((v) => v.file))
  const stale = [...PENDING].filter((file) => !files.has(file))
  assert.deepEqual(stale, [])
})
