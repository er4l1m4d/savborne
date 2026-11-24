'use client'

/**
 * Savborne — the page shown outside Nimiq Pay
 *
 * Everything in the app sits behind a gate that requires the wallet bridge, so
 * a normal browser used to get a headline and nothing else. That is the first
 * thing anyone scoring the Mini App sees: they click the demo link on a laptop
 * and land on a wall. This is the wall, turned into the pitch.
 *
 * It stays honest about what it is: the app does not run here, the screenshots
 * are the shipped screens with sample data, and the only real call to action is
 * the deeplink or the QR a phone can scan. It touches no wallet API, holds no
 * state and reads no player data, so it cannot break the gate it lives behind.
 */

import Image from 'next/image'
import brand from '../../assets/brand.json'
import { ButtonLink } from '@/components/ui/Button'
import { PixelPanel } from '@/components/ui/PixelPanel'

const DEEPLINK = 'nimiqpay://miniapp?url=https://savborne.vercel.app'
const VIDEO = 'https://vimeo.com/user265760449/savborne-demo-video'

const LOOP = [
  {
    n: '01',
    title: 'Deposit NIM',
    body: 'Your Nimiq Pay wallet signs an ordinary transaction into a vault only you control.',
  },
  {
    n: '02',
    title: 'Check in daily',
    body: 'Every check-in reads the vault on chain. One claim per day, never a self-reported number.',
  },
  {
    n: '03',
    title: 'Grow',
    body: 'XP, streaks and streak shields. Balance brackets unlock items and change your character.',
  },
  {
    n: '04',
    title: 'Battle',
    body: 'Duel the AI, challenge a friend, or climb the ranked board once five days are banked.',
  },
]

export function OutsideNimiqPay() {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1040px] flex-col px-6 pt-8 pb-16 md:px-10 md:pt-12">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-7">
          <div className="flex items-center gap-3">
            <svg
              width={44}
              height={44}
              viewBox={brand.logo.viewBox}
              aria-hidden
              focusable="false"
              dangerouslySetInnerHTML={{ __html: brand.logo.paths }}
            />
            <svg
              width={205}
              height={18}
              viewBox={brand.wordmark.viewBox}
              role="img"
              aria-label="Savborne"
              focusable="false"
              dangerouslySetInnerHTML={{ __html: brand.wordmark.paths }}
            />
          </div>
          <span className="sv-section-label text-fg-faint">Nimiq Pay Mini App</span>
        </header>

        <div className="mt-10 grid gap-12 md:mt-14 md:grid-cols-[minmax(0,1fr)_330px] md:gap-14">
          <div>
            <h1 className="text-[clamp(30px,4.4vw,44px)] leading-[1.06] font-extrabold tracking-[-0.03em]">
              Savborne runs inside{' '}
              <span className="text-mint">Nimiq&nbsp;Pay</span>.
            </h1>

            <p className="sv-body mt-5 max-w-[48ch] text-fg-muted">
              A savings RPG. Keep NIM in a vault only you control, check in daily, and turn the
              balance that is really on chain into XP, streaks, items and rank. Nimiq Pay holds the
              wallet and signs every deposit &mdash; that is the only way in.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ButtonLink href={DEEPLINK} variant="primary" size="lg">
                Open in Nimiq Pay
              </ButtonLink>
              <ButtonLink
                href={VIDEO}
                target="_blank"
                rel="noreferrer"
                variant="secondary"
                size="lg"
              >
                Watch the 2-min demo
              </ButtonLink>
            </div>

            <p className="sv-caption mt-3 text-fg-faint">
              Opens Savborne inside the Nimiq Pay app.
            </p>

            <section className="mt-12">
              <h2 className="sv-section-label text-fg-faint">The loop</h2>
              <ol className="mt-4 flex flex-col">
                {LOOP.map((step) => (
                  <li key={step.n} className="flex gap-4 border-t border-line py-4 first:border-t-0 first:pt-0">
                    <span className="sv-figure w-6 shrink-0 pt-1 text-mint">{step.n}</span>
                    <div className="flex flex-col gap-1">
                      <span className="sv-label text-fg">{step.title}</span>
                      <span className="sv-caption text-fg-muted">{step.body}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <PixelPanel className="mt-10 flex flex-col gap-3 p-5">
              <span className="sv-section-label text-mint">Non-custodial</span>
              <p className="sv-caption max-w-[62ch] text-fg-muted">
                Savborne never holds your NIM. Deposits are signed by your wallet, withdrawals by a
                24-word phrase only you have. Lose the phrase and the device, and the NIM is gone.
              </p>
            </PixelPanel>
          </div>

          <div className="flex flex-col items-center gap-5">
            <div className="vpx w-full max-w-[320px] overflow-hidden bg-surface-low">
              <Image
                src="/preview/home.png"
                width={780}
                height={1688}
                alt="Savborne home screen: a Level 7 saver, a 12.40 NIM vault and a daily check-in button."
                className="block h-auto w-full"
                priority
              />
            </div>
            <p className="sv-caption max-w-[300px] text-center text-fg-faint">
              The shipped app, with sample data.
            </p>

            <PixelPanel className="hidden w-full max-w-[320px] flex-col items-center gap-3 p-4 md:flex">
              <Image
                src="/deeplink-qr.png"
                width={148}
                height={148}
                alt="QR code that opens Savborne inside Nimiq Pay"
                className="block"
              />
              <p className="sv-caption text-center text-fg-muted">
                On a laptop? Scan with your phone camera.
              </p>
            </PixelPanel>
          </div>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
          <span className="sv-caption text-fg-faint">
            Savborne &middot; Save for real. Level up for fun.
          </span>
          <a
            href="https://github.com/er4l1m4d/savborne"
            target="_blank"
            rel="noreferrer"
            className="sv-caption text-fg-faint hover:text-mint"
          >
            Source and licence on GitHub
          </a>
        </footer>
      </div>
    </div>
  )
}
