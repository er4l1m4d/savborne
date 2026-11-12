import { test } from 'node:test'
import assert from 'node:assert/strict'
import { placeTourCard } from './tour-placement'

const MARGIN = 16
const GAP = 16

function anchor(top: number, height = 48) {
  return { top, left: 20, width: 350, height, bottom: top + height }
}

test('a mid-screen anchor gets the card below it, capped to the free space', () => {
  const viewport = { width: 390, height: 844 }
  const rect = anchor(400)
  const placement = placeTourCard({ rect, viewport })

  assert.equal(placement.transform, 'translateX(-50%)')
  assert.equal(placement.top, rect.bottom + GAP)
  assert.equal(placement.maxHeight, viewport.height - placement.top! - MARGIN)
  assert.ok(placement.top! >= rect.bottom + GAP)
  assert.ok(placement.top! + placement.maxHeight <= viewport.height - MARGIN)
})

test('an anchor near the bottom gets the card above it, not on top of it', () => {
  const viewport = { width: 390, height: 844 }
  const rect = anchor(620)
  const placement = placeTourCard({ rect, viewport })

  assert.equal(placement.transform, 'translateX(-50%)')
  assert.ok(placement.bottom !== undefined)

  const bottomEdge = viewport.height - placement.bottom!
  assert.ok(bottomEdge <= rect.top - GAP)
  assert.ok(bottomEdge - placement.maxHeight >= MARGIN)
})

test('the card stays inside the desktop app frame', () => {
  const placement = placeTourCard({
    rect: { top: 300, left: 700, width: 40, height: 40, bottom: 340 },
    viewport: { width: 1280, height: 800 },
    frame: { left: 425, right: 855 },
  })

  // Half-width is 180, so the frame leaves the card centre between 613 and
  // 667. The anchor centre is 720 and must clamp to 667.
  assert.equal(placement.left, 667)
})

test('no anchor position is ever covered, on phone and desktop sizes', () => {
  for (const width of [320, 390, 430, 1280]) {
    for (const height of [360, 568, 667, 844, 932]) {
      const viewport = { width, height }

      for (let top = 0; top <= height - 40; top += 10) {
        const rect = anchor(top)
        const placement = placeTourCard({ rect, viewport })
        const label = `${width}x${height} at ${top}: ${JSON.stringify(placement)}`

        if (placement.bottom !== undefined) {
          const bottomEdge = height - placement.bottom
          assert.ok(bottomEdge <= rect.top - GAP, label)
          assert.ok(bottomEdge - placement.maxHeight >= MARGIN, label)
        } else if (placement.transform === 'translateX(-50%)') {
          assert.ok(placement.top! >= rect.bottom + GAP, label)
          assert.ok(placement.top! + placement.maxHeight <= height - MARGIN, label)
        }
      }
    }
  }
})
