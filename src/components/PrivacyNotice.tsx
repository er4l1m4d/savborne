/**
 * Savborne — privacy notice copy
 *
 * One source for the onboarding step and the Settings sheet. The vault is
 * non-custodial, so the important claims are what we never collect and the
 * risk of losing the 24 words.
 */

export function PrivacyNotice() {
  return (
    <div className="flex flex-col gap-2">
      <p className="sv-label text-fg-soft">
        <strong>What we collect.</strong> Your wallet address, your vault address, one
        balance snapshot each time you check in, and game data (XP, missions, items,
        badges, battle results). Your display name is stored for the leaderboard.
      </p>
      <p className="sv-label text-fg-soft">
        <strong>What we do NOT collect.</strong> Your 24 words, your vault passphrase, or
        any data that would let us move or lock your funds. The key exists only on this
        device, encrypted.
      </p>
      <p className="sv-label text-fg-soft">
        <strong>What is public.</strong> Your display name, bracket, level, and leaderboard
        score. Your balance is never shown to other players.
      </p>
      <p className="sv-label text-fg-soft">
        <strong>Where it is stored.</strong> Supabase (US-East) and Vercel. You can request
        deletion by emailing the contact in Settings ΓåÆ Help.
      </p>
      <p className="sv-label text-fg-soft">
        <strong>The risk you are accepting.</strong> If you lose your 24 words and this
        device, the NIM in your vault is unrecoverable. Savborne cannot restore it.
      </p>
    </div>
  )
}
