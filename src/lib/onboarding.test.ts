import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

const SETUP = source('../app/setup/page.tsx')
const LAYOUT = source('../app/(onboarding)/layout.tsx')
const PROVIDER = source('../components/onboarding/OnboardingProvider.tsx')
const SCREEN = source('../components/onboarding/OnboardingScreen.tsx')
const WELCOME = source('../app/(onboarding)/welcome/page.tsx')
const CONNECT = source('../app/(onboarding)/connect/page.tsx')
const QUIZ = source('../components/vault/BackupQuiz.tsx')

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

test('Connect is step 1 with the handoff explainer and can/cannot cards', () => {
  assert.match(CONNECT, /<OnboardingScreen step=\{1\} backHref="\/welcome">/)
  assert.match(CONNECT, /Create your vault/)
  assert.match(CONNECT, /Create your vault\s*<\/Button>/s)
  assert.match(CONNECT, /const EXPLAINER = \[/)
  assert.match(CONNECT, /Savborne can/)
  assert.match(CONNECT, /Savborne cannot/)
  assert.match(CONNECT, /Read the vault balance/)
  assert.match(CONNECT, /Move, lock or spend your NIM/)
  assert.match(CONNECT, /reconnect it instead of/)
})

test('Connect keeps the 24-word ceremony and the ready state', () => {
  assert.match(CONNECT, /<PhraseCeremony/)
  assert.match(CONNECT, /<BackupQuiz/)
  assert.match(CONNECT, /<PassphraseField onSet=\{onLock\} \/>/)
  assert.match(CONNECT, /Your vault is ready/)
  assert.match(CONNECT, /router\.push\('\/privacy'\)/)
  assert.match(CONNECT, /resetVault/)
  assert.match(CONNECT, /startConnect/)
  assert.match(CONNECT, /pickAccount/)
  assert.match(CONNECT, /lockVault/)
  assert.doesNotMatch(CONNECT, /window\.(?:local|session)Storage/)
})

test('the backup quiz owns an h1 only in onboarding', () => {
  assert.match(QUIZ, /const Heading = inline \? 'h2' : 'h1'/)
  assert.match(QUIZ, /<Heading className=\{inline \? 'sv-heading' : 'sv-heading-lg'\}>/)
})

test('Privacy is step 2 and hands the accepted version to the draft', () => {
  const PRIVACY_PAGE = source('../app/(onboarding)/privacy/page.tsx')
  assert.match(PRIVACY_PAGE, /<OnboardingScreen step=\{2\} backHref="\/connect">/)
  assert.match(PRIVACY_PAGE, /<PrivacyNotice variant="full" \/>/)
  assert.match(PRIVACY_PAGE, /acceptPrivacy\(PRIVACY_NOTICE_VERSION\)/)
  assert.match(PRIVACY_PAGE, /router\.push\('\/name'\)/)
})
