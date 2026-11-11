/**
 * Savborne - privacy notice copy
 *
 * One source for the onboarding cards, the Settings summary and the notice
 * version stored on the player. The vault is non-custodial, so the important
 * claims are what we never collect and the risk of losing the 24 words.
 */

export const PRIVACY_NOTICE_VERSION = '2026-11-11'

export const PRIVACY_CONTACT = 'damilareogooluwade@outlook.com'

export const PRIVACY_SHORT_VERSION =
  'Savborne never holds, moves, or controls your money. We read your vault balance to track check-ins and streaks.'

export type PrivacyCardTone = 'mint' | 'coral' | 'muted'

export type PrivacyCard = {
  key: string
  title: string
  tone: PrivacyCardTone
  body: string
}

export const PRIVACY_CARDS: PrivacyCard[] = [
  {
    key: 'collect',
    title: 'What we collect',
    tone: 'mint',
    body: 'Your wallet address, your vault address, your display name and character, balance snapshots (each check-in and a daily server reading), transfers and receipts, battles and queue entries, and when you accepted this notice.',
  },
  {
    key: 'not-collect',
    title: "What we don't",
    tone: 'coral',
    body: 'Your 24 words, your vault passphrase, other balances, or anything that lets us move or lock your funds.',
  },
  {
    key: 'public',
    title: "What's public",
    tone: 'muted',
    body: 'Your display name, level, bracket and leaderboard score are visible to other players. Your wallet address, vault address and balance are never shown on any public or in-app leaderboard.',
  },
  {
    key: 'stored',
    title: "Where it's stored",
    tone: 'muted',
    body: 'Supabase and Vercel. Account data is kept while your account exists. Settings > Delete account removes your player row, vault mapping, readings, transfers, battles and public card. The vault itself is on the Nimiq chain and cannot be deleted by Savborne; its on-chain history remains public.',
  },
]

export const PRIVACY_RISK =
  'If you lose your 24 words and this device, the NIM in your vault is unrecoverable. Savborne cannot restore it.'

export const PRIVACY_DISCLOSURE_TITLE = "What's public and where it's stored"

export const PRIVACY_CONSENT_LINE =
  'By tapping Continue, you agree to this notice and to Savborne storing your vault address, balance snapshots and game data as described. Questions or deletion help: damilareogooluwade@outlook.com.'
