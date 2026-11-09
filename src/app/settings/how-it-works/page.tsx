import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { PrivacyNotice } from '@/components/PrivacyNotice'
import {
  BACKUP_QUIZ_NOTE,
  BACKUP_RISK,
  PASSPHRASE_NOTE,
  PASSPHRASE_RESET_NOTE,
  VAULT_CAN,
  VAULT_CANNOT,
  VAULT_INTRO,
  VAULT_STEPS,
} from '@/lib/onboarding-copy'

/**
 * Savborne - How Savborne works
 *
 * The calm reference for everything the onboarding screens keep short. Linked
 * from Settings > Help; the same copy module feeds onboarding so the two cannot
 * drift.
 */
export default function HowItWorksPage() {
  return (
    <ScreenShell variant="pushed" backHref="/settings" title="How Savborne works">
      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Your vault</h2>
        <PixelPanel className="p-4 flex flex-col gap-4">
          <p className="sv-body text-fg-muted">{VAULT_INTRO}</p>

          <ol className="flex flex-col gap-4">
            {VAULT_STEPS.map((line, index) => (
              <li key={line} className="flex items-start gap-[14px]">
                <span className="w-7 h-7 shrink-0 bg-mint text-background text-sm font-bold flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-[15px] leading-[1.45] font-semibold">{line}</span>
              </li>
            ))}
          </ol>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="sv-label text-mint">Savborne can</span>
              <span className="text-sm font-semibold leading-snug">{VAULT_CAN}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="sv-label text-coral-text">Savborne cannot</span>
              <span className="text-sm font-semibold leading-snug">{VAULT_CANNOT}</span>
            </div>
          </div>
        </PixelPanel>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Backup and recovery</h2>
        <PixelPanel className="p-4 flex flex-col gap-3">
          <p className="text-[15px] leading-[1.45] font-semibold">{BACKUP_RISK}</p>
          <p className="sv-label text-fg-muted">{BACKUP_QUIZ_NOTE}</p>
          <p className="sv-label text-fg-muted">{PASSPHRASE_NOTE}</p>
          <p className="sv-label text-fg-muted">{PASSPHRASE_RESET_NOTE}</p>
        </PixelPanel>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Privacy and data</h2>
        <PrivacyNotice variant="full" />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="sv-section-label text-mint">Nimiq Pay</h2>
        <PixelPanel className="p-4 flex flex-col gap-2">
          <p className="sv-label text-fg-muted">
            Savborne runs inside Nimiq Pay. If the app is too old to share a balance,
            Savborne asks you to update it.
          </p>
          <p className="sv-label text-fg-muted">
            If a balance read fails, the check-in is not recorded and your streak and
            XP are safe.
          </p>
        </PixelPanel>
      </section>
    </ScreenShell>
  )
}
