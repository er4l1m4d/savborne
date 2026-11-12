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

test('a side that fits the whole card beats a nearer side that would scroll', () => {
  const viewport = { width: 390, height: 568 }
  const rect = anchor(300) // bottom 348; 188 below, 268 above

  // Without a measured height the old heuristic picks below and scrolls.
  const unmeasured = placeTourCard({ rect, viewport })
  assert.equal(unmeasured.top, rect.bottom + GAP)
  assert.ok(unmeasured.maxHeight < 220)

  // With the real height it flips above, where the whole card fits.
  const measured = placeTourCard({ rect, viewport, cardHeight: 220 })
  assert.equal(measured.bottom, viewport.height - rect.top + GAP)
  assert.ok(measured.maxHeight >= 220)
})

test('both sides fitting keeps below and leaves the card unconstrained', () => {
  const viewport = { width: 390, height: 844 }
  const rect = anchor(300)
  const placement = placeTourCard({ rect, viewport, cardHeight: 220 })

  assert.equal(placement.top, rect.bottom + GAP)
  assert.ok(placement.maxHeight >= 220)
})

test('when neither side fits, the larger side is used and capped to it', () => {
  const viewport = { width: 390, height: 400 }
  const rect = anchor(180) // 140 below, 148 above
  const placement = placeTourCard({ rect, viewport, cardHeight: 300 })

  assert.equal(placement.transform, 'translateX(-50%)')
  assert.ok(placement.bottom !== undefined)
  assert.equal(placement.maxHeight, 148)
})

test('a tight side switches the card to its compact layout', () => {
  const viewport = { width: 390, height: 667 }
  const placement = placeTourCard({ rect: anchor(300), viewport })
  // 287px below and 268px above: neither is a roomy full card.
  assert.equal(placement.compact, true)
})

test('a roomy side keeps the full card layout', () => {
  const viewport = { width: 390, height: 844 }
  const placement = placeTourCard({ rect: anchor(300), viewport })
  assert.equal(placement.compact, false)
})

test('no anchor position is ever covered, on phone and desktop sizes', () => {
  const cardHeight = 220

  for (const width of [320, 390, 430, 1280]) {
    for (const height of [360, 568, 667, 844, 932]) {
      const viewport = { width, height }

      for (let top = 0; top <= height - 40; top += 10) {
        const rect = anchor(top)
        const placement = placeTourCard({ rect, viewport, cardHeight })
        const label = `${width}x${height} at ${top}: ${JSON.stringify(placement)}`

        const spaceBelow = Math.max(0, height - rect.bottom - MARGIN - GAP)
        const spaceAbove = Math.max(0, rect.top - MARGIN - GAP)
        const largest = Math.max(spaceAbove, spaceBelow)

        if (placement.transform === 'translate(-50%, -50%)') {
          // Only for sides too short to be worth using.
          assert.ok(largest < 120, label)
          continue
        }

        if (placement.bottom !== undefined) {
          const bottomEdge = height - placement.bottom
          assert.ok(bottomEdge <= rect.top - GAP, label)
          assert.ok(bottomEdge - placement.maxHeight >= MARGIN, label)
        } else {
          assert.ok(placement.top! >= rect.bottom + GAP, label)
          assert.ok(placement.top! + placement.maxHeight <= height - MARGIN, label)
        }

        // A side that can show the whole card is never constrained.
        if (largest >= cardHeight) {
          assert.ok(placement.maxHeight >= cardHeight, label)
        } else {
          assert.equal(placement.maxHeight, largest, label)
        }
      }
    }
  }
})
