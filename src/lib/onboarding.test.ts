import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SETUP = source('../app/setup/page.tsx')
const LAYOUT = source('../app/(onboarding)/layout.tsx')
const PROVIDER = source('../components/onboarding/OnboardingProvider.tsx')
const SCREEN = source('../components/onboarding/OnboardingScreen.tsx')
const WELCOME = source('../app/(onboarding)/welcome/page.tsx')

test('/setup redirects to /welcome', () => {
  assert.match(SETUP, /redirect\('\/welcome'\)/)
})

test('the onboarding group shares one provider', () => {
  assert.match(LAYOUT, /<OnboardingProvider>/)
  assert.match(PROVIDER, /createContext<OnboardingContextValue \| null>/)
  assert.match(PROVIDER, /readSession\(\)/)
  assert.match(PROVIDER, /reconnectDecision\(res\.status\)/)
  assert.match(PROVIDER, /writeSession\(sessionFromProfile\(profile\)\)/)
  assert.match(PROVIDER, /generatePhrase\(\)/)
  assert.match(PROVIDER, /encryptPhrase\(phrase, passphrase\)/)
  assert.match(PROVIDER, /writeVault\(picked,/)
})

test('the phrase never reaches browser storage', () => {
  assert.doesNotMatch(PROVIDER, /window\.(?:local|session)Storage/)
  assert.doesNotMatch(PROVIDER, /\.(?:setItem|getItem)\(/)
  assert.match(PROVIDER, /setPhrase\(null\)/)
})

test('the shared screen carries the step label and bars', () => {
  assert.match(SCREEN, /aria-current="step"/)
  assert.match(SCREEN, /Step \{step\} of 3/)
  assert.match(SCREEN, /<StepBars step=\{step\} total=\{3\} \/>/)
  assert.match(SCREEN, /variant="pushed"/)
})

test('Welcome uses the brand, character art, coral CTA and footer', () => {
  assert.match(WELCOME, /<BrandMark \/>/)
  assert.match(WELCOME, /<CharacterArt bracket=\{null\} size=\{144\} \/>/)
  assert.match(WELCOME, /sv-display-sm/)
  assert.match(WELCOME, /Save for real\./)
  assert.match(WELCOME, /Level up for fun\./)
  assert.match(WELCOME, /href="\/connect"/)
  assert.match(WELCOME, /variant="primary"/)
  assert.match(WELCOME, /Built for Nimiq Pay/)
  assert.doesNotMatch(WELCOME, /StepBars/)
})
