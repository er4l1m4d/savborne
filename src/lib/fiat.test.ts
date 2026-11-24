import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MIN_DISPLAY_FIAT,
  SUPPORTED_FIATS,
  fiatValue,
  formatFiat,
  resolveFiat,
} from './fiat'

test('a currency we can price resolves to itself, in any casing', () => {
  assert.equal(resolveFiat('EUR'), 'EUR')
  assert.equal(resolveFiat(' eur '), 'EUR')
  assert.equal(resolveFiat('CRC'), 'CRC')
})

test('anything we cannot price falls back to USD instead of inventing a rate', () => {
  // GMD is in the SDK's enum but not in the quote we receive.
  assert.equal(resolveFiat('GMD'), 'USD')
  assert.equal(resolveFiat('NGN'), 'USD')
  assert.equal(resolveFiat(undefined), 'USD')
  assert.equal(resolveFiat(null), 'USD')
  assert.equal(resolveFiat(''), 'USD')
  assert.equal(resolveFiat(42), 'USD')
})

test('every supported code is one the formatter can render', () => {
  for (const code of SUPPORTED_FIATS) {
    const text = formatFiat(1, code)
    assert.equal(typeof text, 'string')
    assert.ok(text.length > 0, `${code} formatted to nothing`)
  }
})

test('a balance worth less than a cent is hidden, not shown as zero', () => {
  // 12.40 NIM at NIM's current rate is a fraction of a cent; "$0.00 saved"
  // would be worse than no line at all.
  assert.equal(fiatValue(12.4, 0.00018508), null)
  assert.equal(fiatValue(MIN_DISPLAY_FIAT / 0.00018508 - 0.01, 0.00018508), null)
})

test('a balance worth a cent or more converts', () => {
  const value = fiatValue(1000, 0.00018508)
  assert.ok(value !== null)
  assert.ok(Math.abs(value - 0.18508) < 1e-9)
})

test('a missing or nonsense rate hides the line rather than throwing', () => {
  assert.equal(fiatValue(1000, null), null)
  assert.equal(fiatValue(1000, undefined), null)
  assert.equal(fiatValue(1000, Number.NaN), null)
  assert.equal(fiatValue(1000, 0), null)
  assert.equal(fiatValue(1000, -1), null)
  assert.equal(fiatValue(Number.NaN, 0.5), null)
  assert.equal(fiatValue(0, 0.5), null)
})

test('formatting is currency-correct and always two decimals', () => {
  assert.equal(formatFiat(8.1, 'USD'), '$8.10')
  assert.equal(formatFiat(1234.5, 'USD'), '$1,234.50')
  assert.match(formatFiat(8.1, 'EUR'), /8\.10/)
  assert.match(formatFiat(8.1, 'CRC'), /8\.10/)
})
