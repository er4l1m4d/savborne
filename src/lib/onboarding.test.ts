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
const STEPS = source('../components/ui/StepBars.tsx')

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
  assert.match(PROVIDER, /setAvatar/)
  assert.match(PROVIDER, /avatar,\n\s+privacyNoticeVersion: acceptedNoticeVersion/)
})

test('onboarding offers only the signable account and surfaces session errors', () => {
  assert.match(PROVIDER, /signingAccount\(list\)/)
  assert.match(PROVIDER, /await ensureSessionToken\(identity\)/)
})

test('the phrase never reaches browser storage', () => {
  assert.doesNotMatch(PROVIDER, /window\.(?:local|session)Storage/)
  assert.doesNotMatch(PROVIDER, /\.(?:setItem|getItem)\(/)
  assert.match(PROVIDER, /setPhrase\(null\)/)
})

test('the shared screen carries the five-step label and bars', () => {
  assert.match(SCREEN, /<StepLabel step=\{step\} total=\{total\} \/>/)
  assert.match(SCREEN, /<StepBars step=\{step\} total=\{total\} \/>/)
  assert.match(SCREEN, /total = 5/)
  assert.match(SCREEN, /variant="pushed"/)
  assert.match(STEPS, /aria-current="step"/)
  assert.match(STEPS, /Step \{current\} of \{safeTotal\}/)
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
  assert.match(WELCOME, /<StepLabel step=\{1\} total=\{5\} \/>/)
  assert.match(WELCOME, /<StepBars step=\{1\} total=\{5\} \/>/)
})

test('Connect is steps 2 and 3 with the vault cards', () => {
  assert.match(CONNECT, /const step = stage === 'intro' \|\| stage === 'pick' \? 2 : 3/)
  assert.match(CONNECT, /<OnboardingScreen step=\{step\} backHref="\/welcome">/)
  assert.match(CONNECT, /Create your vault/)
  assert.match(CONNECT, /Create your vault\s*<\/Button>/s)
  assert.match(CONNECT, /from '@\/lib\/onboarding-copy'/)
  assert.match(CONNECT, /VAULT_INTRO/)
  assert.match(CONNECT, /VAULT_STEPS/)
  assert.match(CONNECT, /VAULT_CAN\b/)
  assert.match(CONNECT, /VAULT_CANNOT/)
  assert.match(CONNECT, /<details>/)
  assert.match(CONNECT, /How your vault works/)
  assert.doesNotMatch(CONNECT, /const EXPLAINER/)
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

test('Privacy is step 4 and hands the accepted version to the draft', () => {
  const PRIVACY_PAGE = source('../app/(onboarding)/privacy/page.tsx')
  assert.match(PRIVACY_PAGE, /<OnboardingScreen step=\{4\} backHref="\/connect">/)
  assert.match(PRIVACY_PAGE, /<PrivacyNotice variant="onboarding" \/>/)
  assert.match(PRIVACY_PAGE, /acceptPrivacy\(PRIVACY_NOTICE_VERSION\)/)
  assert.match(PRIVACY_PAGE, /router\.push\('\/name'\)/)
})

test('Name is step 5 with the preview, counter and error slot', () => {
  const NAME = source('../app/(onboarding)/name/page.tsx')
  assert.match(NAME, /<OnboardingScreen step=\{5\} backHref="\/privacy">/)
  assert.match(NAME, /<CharacterArt bracket=\{null\} character=\{avatar\} size=\{128\} \/>/)
  assert.match(NAME, /<CharacterPicker value=\{avatar\} onChange=\{setAvatar\} \/>/)
  assert.match(NAME, /legend className="sv-label text-fg-muted">Character/)
  assert.match(NAME, /maxLength=\{DISPLAY_NAME_MAX\}/)
  assert.match(NAME, /aria-describedby="name-hint name-count name-error"/)
  assert.match(NAME, /\{displayName\.length\}\/\{DISPLAY_NAME_MAX\}/)
  assert.match(NAME, /<Banner tone="error">/)
  assert.match(NAME, /Start playing/)
  assert.match(NAME, /router\.replace\('\/connect'\)/)
  assert.match(NAME, /router\.replace\('\/privacy'\)/)
})
