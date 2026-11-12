import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  rankTone,
  boardFooter,
  isFriendsEmpty,
  shouldPinYou,
  footerLegend,
} from './ranks-ui'

const HANDOFF = readFileSync(new URL('../../Savborne-handoff.html', import.meta.url), 'utf8')
const CROWN = readFileSync(new URL('../components/RankCrown.tsx', import.meta.url), 'utf8')

test('ranks 1-3 use strong text and 4+ use muted text', () => {
  assert.equal(rankTone(1), 'strong')
  assert.equal(rankTone(3), 'strong')
  assert.equal(rankTone(4), 'muted')
  assert.equal(rankTone(50), 'muted')
})

test('the footer line is board-specific and keeps the display-name promise', () => {
  assert.match(boardFooter('ranked'), /Ranked points from human ranked battles\./)
  assert.match(boardFooter('unranked'), /Savings score from check-in growth and consistency\./)
  for (const board of ['ranked', 'unranked'] as const) {
    assert.match(
      boardFooter(board),
      /Only display names are shown, never addresses or balances\./,
    )
  }
})

test('friends is empty when nobody but the caller is on the board', () => {
  assert.equal(isFriendsEmpty([]), true)
  assert.equal(isFriendsEmpty([{ isMe: true }]), true)
  assert.equal(isFriendsEmpty([{ isMe: true }, { isMe: false }]), false)
  assert.equal(isFriendsEmpty([{ isMe: false }]), false)
})

test('the caller is pinned only when absent from the list', () => {
  const you = { rank: 57 }
  assert.equal(shouldPinYou([{ isMe: false }], you), true)
  assert.equal(shouldPinYou([{ isMe: true }], you), false)
  assert.equal(shouldPinYou([{ isMe: false }], null), false)
})

test('the legend counts players and explains the verified marker only when shown', () => {
  assert.equal(footerLegend(1, false), '1 player')
  assert.equal(footerLegend(3, false), '3 players')
  assert.equal(footerLegend(3, true), '3 players · ⟡ verified saver')
})

test('the rank-1 crown is the handoff drawing, verbatim', () => {
  const figure = HANDOFF.slice(HANDOFF.indexOf('id="A_RanksRanked"'))
  const crownStart = figure.indexOf('aria-label="Golden Crown badge"')
  assert.ok(crownStart > 0, 'handoff crown is present')
  const svgEnd = figure.indexOf('</svg>', crownStart)
  const svg = figure.slice(crownStart, svgEnd)
  const paths = [...svg.matchAll(/d="([^"]+)"/g)].map((match) => match[1])
  assert.ok(paths.length >= 2, 'handoff crown has two paths')
  for (const d of paths) {
    assert.ok(CROWN.includes(d), `crown path missing: ${d.slice(0, 24)}...`)
  }
})

const ROUTE = readFileSync(
  new URL('../app/api/leaderboards/route.ts', import.meta.url),
  'utf8',
)

test('the leaderboard response adds you without changing rows or total', () => {
  assert.match(ROUTE, /const all = rows\.map\(toRow\)/)
  assert.match(ROUTE, /const top = all\.slice\(0, 50\)/)
  assert.match(ROUTE, /const you = all\.find\(\(r\) => r\.isMe\) \?\? null/)
  assert.match(ROUTE, /rows: top, total: all\.length, you/)
  assert.match(ROUTE, /b\.rating - a\.rating \|\| b\.wins - a\.wins/)
  assert.match(
    ROUTE,
    /b\.rating - a\.rating \|\| b\.streak_current - a\.streak_current \|\| b\.wins - a\.wins/,
  )
  assert.match(ROUTE, /amountScore: hidden \? null : board === 'unranked' \? r\.losses : null/)
  assert.match(ROUTE, /consistencyScore: hidden \? null : board === 'unranked' \? r\.ties : null/)
})

const PAGE = readFileSync(
  new URL('../app/(tabs)/leaderboard/page.tsx', import.meta.url),
  'utf8',
)

test('the page uses the shared primitives only', () => {
  for (const part of [
    '<Tabs',
    '<FilterBar',
    '<PixelPanel',
    '<Row',
    '<Banner',
    '<Button',
    '<LoadingState />',
    '<Chip variant="fill">',
  ]) {
    assert.match(PAGE, new RegExp(part.replace(/[<>/=]/g, '\\$&')), part)
  }
  assert.doesNotMatch(PAGE, /vpx|FilterChip|Friends on|Friends off/)
})

test('the page ports the tabs, filter and row anatomy', () => {
  assert.match(PAGE, /ariaLabel="Leaderboard"/)
  assert.match(PAGE, /ariaLabel="Board filter"/)
  assert.match(PAGE, /Everyone/)
  assert.match(PAGE, /Friends/)
  assert.match(PAGE, /min-h-11 items-center justify-between/)
  assert.match(PAGE, />Show</)
  assert.match(PAGE, /w-\[26px\]/)
  assert.match(PAGE, /w-\[52px\]/)
  assert.match(PAGE, /min-\[360px\]:inline-block/)
  assert.match(PAGE, /text-\[15px\]/)
  assert.match(PAGE, /board === 'ranked'[\s\S]{0,80}\? 'w-10 min-\[360px\]:w-12'/)
  assert.match(PAGE, /sv-caption font-bold text-fg-muted/)
  assert.match(PAGE, /variant=\{isYou \? 'you' : 'default'\}/)
  assert.match(PAGE, /px-3\.5 py-2/)
  assert.match(PAGE, /!rows\[i \+ 1\]\?\.isMe/)
  assert.doesNotMatch(PAGE, /Lvl |\(you\)/)
  assert.doesNotMatch(PAGE, /\{row\.streak\}|\{row\.wins\}/)
})

test('the page draws the crown and the verified marker', () => {
  assert.match(PAGE, /rank === 1 && <RankCrown/)
  assert.match(PAGE, /verifiedSaver/)
  assert.match(PAGE, /Verified saver/)
})

test('the page pins your rank in a mint container with a plain row', () => {
  assert.match(PAGE, /shouldPinYou\(/)
  assert.match(PAGE, /Your rank/)
  assert.match(PAGE, /<RankRowView\s+row=\{you\}/)
  assert.match(PAGE, /tone="mint"/)
  assert.match(PAGE, /highlight=\{false\}/)
})

test('the page keeps the board, friends and state contracts', () => {
  assert.match(PAGE, /boardFooter\(/)
  assert.match(PAGE, /isFriendsEmpty\(/)
  assert.match(PAGE, /footerLegend\(/)
  assert.match(PAGE, /No friends on this board yet\./)
  assert.match(PAGE, /Nobody on this board yet\./)
  assert.match(PAGE, /Couldn't load ranks\./)
  assert.match(PAGE, /Try again/)
  assert.match(PAGE, /res\.status === 401/)
  assert.match(PAGE, /router\.replace\('\/setup'\)/)
  assert.doesNotMatch(PAGE, /err\.message|error\.message/)
})
