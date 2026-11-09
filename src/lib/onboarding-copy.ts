/**
 * Savborne - onboarding copy
 *
 * The short visible version lives on the onboarding screens; the same strings
 * feed the "How Savborne works" reference in Settings so the two cannot drift.
 */

export const VAULT_INTRO =
  'Choose the wallet account that identifies you. Savborne creates a vault only you control. You need at least 1 NIM in it to join.'

export const VAULT_STEPS = [
  'Approve sharing your wallet address in Nimiq Pay.',
  'Savborne creates 24 words on this device and derives a vault only you control.',
  'Write the words down and lock the vault with a passphrase. Savborne reads its balance at each check-in.',
]

export const VAULT_CAN = 'Read the vault balance'
export const VAULT_CANNOT = 'Move, lock or spend your NIM'

export const BACKUP_RISK =
  'These 24 words are the only key to your vault. If you lose them and this phone, the NIM is gone and Savborne cannot recover it.'

export const PASSPHRASE_NOTE =
  'This passphrase locks your vault on this device and is asked for before every withdrawal. You can reset it with your 24 words.'

export const PASSPHRASE_RESET_NOTE =
  'Savborne cannot reset the passphrase for you; your 24 words can.'

export const BACKUP_QUIZ_NOTE =
  'The four-word check is a speed bump that proves you wrote something down; it is not proof of a perfect backup.'
