import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { PRIVACY_CONTACT } from '@/lib/privacy'

/**
 * Savborne - plain-language terms and support.
 *
 * This is a game around a self-custodied wallet, not a financial service. The
 * page states that plainly, points at the privacy notice for data handling and
 * gives a human contact for deletion or account problems.
 */
export default function TermsPage() {
  return (
    <ScreenShell variant="pushed" backHref="/settings" title="Terms and support">
      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">The short version</h2>
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="text-[15px] leading-[1.45] font-semibold">
            Savborne is a free game layer around a savings account you control.
            It is not a bank, a broker, or a custodial wallet.
          </p>
          <p className="sv-label text-fg-muted">
            The NIM in your vault belongs to whoever holds the 24 words. Savborne
            never holds those words, never signs a withdrawal, and cannot move,
            freeze or recover your funds.
          </p>
        </PixelPanel>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Your responsibility</h2>
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-label text-fg-muted">
            Back up the 24 words and the vault passphrase offline. If you lose
            them and your device, the NIM in the vault is unrecoverable. Savborne
            cannot restore it, and no support request can reverse a signed
            on-chain transfer.
          </p>
          <p className="sv-label text-fg-muted">
            Only deposit what you are prepared to hold yourself. Balance
            readings, brackets, XP and badges are game state, not a promise of
            returns or a guarantee that a vault is safe from every risk.
          </p>
        </PixelPanel>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Fair use</h2>
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-label text-fg-muted">
            Play with your own wallet. Do not automate check-ins, script ranked
            battles, probe other players&apos; data, or attempt to bypass the signed
            session. Accounts that do may be removed.
          </p>
        </PixelPanel>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Availability and changes</h2>
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-label text-fg-muted">
            Savborne is provided as-is, without warranty. Game rules, rewards and
            screens may change. The service may pause or stop; your vault and its
            on-chain history remain yours either way.
          </p>
          <p className="sv-label text-fg-muted">
            The source is MIT licensed. Nothing here creates a custodial,
            investment or advisory relationship.
          </p>
        </PixelPanel>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Privacy and deletion</h2>
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="sv-label text-fg-muted">
            Settings &gt; How Savborne works shows the full privacy notice: what is
            stored, what other players can see, and what deletion removes. You can
            delete your account from Settings &gt; Delete account. The on-chain
            vault is not deletable by Savborne.
          </p>
          <p className="sv-label text-fg-muted">
            Support, privacy questions and deletion help:{' '}
            <a className="text-mint underline" href={`mailto:${PRIVACY_CONTACT}`}>
              {PRIVACY_CONTACT}
            </a>
          </p>
        </PixelPanel>
      </section>
    </ScreenShell>
  )
}
