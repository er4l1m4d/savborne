'use client'

/**
 * Savborne — Settings
 *
 * The handoff has a settings icon on Profile but no Settings markup, so this is
 * a designed extension: account facts, vault backup, help, about, and the two
 * destructive actions. Every control here does something real; there are no
 * preference toggles for settings the app cannot honour.
 *
 * Disconnect is local only. It clears the session and this device's vault key;
 * the profile and vault mapping stay on the server, and Setup reconnects the
 * wallet from the 24 words.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import pkg from '../../../package.json'
import { authHeaders, readSession, writeSession } from '@/lib/session'
import { clearVault, readVault } from '@/lib/vault/storage'
import { disconnectPlan } from '@/lib/reconnect'
import type { Avatar } from '@/lib/avatar'
import type { Bracket } from '@/lib/constants'
import { CharacterPicker } from '@/components/CharacterPicker'
import { TOUR_FLAG_KEY } from '@/components/VaultTour'
import { BackupSettings } from '@/components/vault/BackupSettings'
import { PrivacyNotice } from '@/components/PrivacyNotice'
import { ScreenShell } from '@/components/ui/ScreenShell'
import { PixelPanel } from '@/components/ui/PixelPanel'
import { Row } from '@/components/ui/Row'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Banner } from '@/components/ui/Banner'
import { BottomSheet } from '@/components/ui/BottomSheet'

const CONTACT_EMAIL = 'damilareogooluwade@outlook.com'

type Profile = {
  player: {
    address: string
    displayName: string
    avatar: Avatar
    bracket: Bracket | null
  }
}

type SettingsVault = {
  address: string
  backupVerifiedAt: string | null
}

type Sheet = 'privacy' | 'disconnect' | null

export default function SettingsPage() {
  const router = useRouter()
  const [playerAddress, setPlayerAddress] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState<Avatar>('hero')
  const [bracket, setBracket] = useState<Bracket | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [vault, setVault] = useState<SettingsVault | null>(null)
  const [vaultUnavailable, setVaultUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [hasLocalVault, setHasLocalVault] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setVaultUnavailable(false)
    try {
      const [profileRes, vaultRes] = await Promise.all([
        fetch('/api/profile', { headers: authHeaders() }),
        fetch('/api/vaults', { headers: authHeaders() }),
      ])

      if (profileRes.status === 401) {
        router.replace('/setup')
        return
      }
      if (!profileRes.ok) {
        throw new Error(`Could not load settings (${profileRes.status}).`)
      }

      const profile = (await profileRes.json()) as Profile
      setDisplayName(profile.player.displayName)
      setAvatar(profile.player.avatar ?? 'hero')
      setBracket(profile.player.bracket ?? null)

      if (vaultRes.ok) {
        const body = (await vaultRes.json()) as { vault: SettingsVault | null }
        setVault(body.vault)
      } else {
        // The account facts still matter when the vault probe is down.
        setVaultUnavailable(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load settings.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    const session = readSession()
    if (!session) {
      router.replace('/setup')
      return
    }
    setPlayerAddress(session.playerAddress)
    setDisplayName(session.displayName)
    void load()
  }, [load, router])

  async function changeAvatar(next: Avatar) {
    if (busy || next === avatar) return
    setBusy(true)
    setAvatarError(null)
    try {
      const res = await fetch('/api/players/me', {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ avatar: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Could not save (${res.status}).`)
      }
      setAvatar(next)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Could not save the character.')
    } finally {
      setBusy(false)
    }
  }

  function showTourAgain() {
    try {
      window.localStorage.removeItem(TOUR_FLAG_KEY)
    } catch {
      // Non-fatal.
    }
    router.push('/vault')
  }

  function openDisconnect() {
    if (!playerAddress) return
    setHasLocalVault(readVault(playerAddress) !== null)
    setSheet('disconnect')
  }

  function disconnect() {
    if (!playerAddress || busy) return
    setBusy(true)
    try {
      if (disconnectPlan(hasLocalVault) === 'vault-and-session') {
        clearVault(playerAddress)
      }
    } catch {
      // A blocked storage API must not trap the player on a disabled sheet.
    }
    try {
      writeSession(null)
    } catch {
      // Best-effort.
    }
    // A hard navigation drops cached player state and every mounted hook.
    window.location.replace('/setup')
  }

  const vaultValue = vaultUnavailable
    ? 'Vault unavailable'
    : vault
      ? short(vault.address)
      : 'Not created'

  return (
    <ScreenShell variant="pushed" title="Settings" backHref="/profile">
      {loading ? (
        <p className="sv-body text-fg-muted">Loading settings…</p>
      ) : error ? (
        <>
          <Banner tone="error">{error}</Banner>
          <Button variant="ghost" className="self-start" onClick={() => void load()}>
            Retry
          </Button>
        </>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="sv-section-label text-mint">Account</h2>
            <PixelPanel className="px-4 py-0">
              <Row divider>
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="sv-label text-fg-muted">Display name</span>
                  <span className="sv-label font-bold sv-break text-right">{displayName}</span>
                </div>
              </Row>
              <Row divider>
                <div className="flex w-full flex-col gap-2 py-2">
                  <span className="sv-label text-fg-muted">Character</span>
                  <CharacterPicker
                    value={avatar}
                    onChange={changeAvatar}
                    bracket={bracket}
                    disabled={busy}
                  />
                </div>
              </Row>
              <Row divider>
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="sv-label text-fg-muted">Vault address</span>
                  <span className="sv-figure font-mono sv-break text-right">{vaultValue}</span>
                </div>
              </Row>
              <Row>
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="sv-label text-fg-muted">Backup</span>
                  {vaultUnavailable ? (
                    <span className="sv-label text-fg-muted">Unavailable</span>
                  ) : vault?.backupVerifiedAt ? (
                    <span className="sv-label text-mint">Verified</span>
                  ) : (
                    <span className="sv-label text-coral-text">Not backed up</span>
                  )}
                </div>
              </Row>
            </PixelPanel>
            {avatarError && <Banner tone="error">{avatarError}</Banner>}
          </section>

          <BackupSettings />

          <section className="flex flex-col gap-2">
            <h2 className="sv-section-label text-mint">Help</h2>
            <PixelPanel className="px-4 py-0">
              <Row divider>
                <ButtonLink
                  href="/settings/how-it-works"
                  variant="ghost"
                  className="w-full justify-start px-0 text-fg"
                >
                  How Savborne works
                </ButtonLink>
              </Row>
              <Row divider>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-0 text-fg"
                  onClick={showTourAgain}
                >
                  Show tour again
                </Button>
              </Row>
              <Row>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-0 text-fg"
                  onClick={() => {
                    window.location.href = `mailto:${CONTACT_EMAIL}`
                  }}
                >
                  Contact
                </Button>
              </Row>
            </PixelPanel>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="sv-section-label text-mint">About</h2>
            <PixelPanel className="px-4 py-0">
              <Row divider>
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="sv-label text-fg-muted">Version</span>
                  <span className="sv-label font-bold text-fg">v{pkg.version}</span>
                </div>
              </Row>
              <Row divider>
                <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span className="sv-label text-fg-muted">Your address</span>
                  <span className="sv-figure font-mono sv-break text-right">
                    {playerAddress ? short(playerAddress) : '—'}
                  </span>
                </div>
              </Row>
              <Row>
                <Button
                  variant="ghost"
                  className="w-full justify-start px-0 text-fg"
                  onClick={() => setSheet('privacy')}
                >
                  Privacy notice
                </Button>
              </Row>
            </PixelPanel>
            <p className="sv-label text-fg-faint">
              Savborne never holds your NIM. A 24-word phrase generated on your device controls
              your vault. Balances are read from the chain, never stored by us.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="sv-section-label text-coral-text">Danger zone</h2>
            <Button variant="destructive" className="justify-start" onClick={openDisconnect}>
              Disconnect savings account
            </Button>
            <ButtonLink
              variant="destructive"
              href="/settings/delete"
              className="justify-start"
            >
              Delete account
            </ButtonLink>
          </section>

          <BottomSheet
            open={sheet === 'privacy'}
            onClose={() => setSheet(null)}
            title="Privacy notice"
          >
            <div className="flex flex-col gap-3">
              <PrivacyNotice />
              <Button variant="ghost" onClick={() => setSheet(null)}>
                Close
              </Button>
            </div>
          </BottomSheet>

          <BottomSheet
            open={sheet === 'disconnect'}
            onClose={() => {
              if (!busy) setSheet(null)
            }}
            title="Disconnect this device?"
          >
            <div className="flex flex-col gap-3">
              <p className="sv-label text-fg-muted">
                {hasLocalVault
                  ? 'This removes the vault key and your session from this device. Your profile, level, streak and vault stay on the server. The NIM in the vault is untouched, and your 24 words still control it.'
                  : 'This device has no vault key; this only signs you out. Your profile, level, streak and vault stay on the server.'}
              </p>
              <p className="sv-label text-fg-muted">
                To use the vault again, reconnect this wallet in Setup, then restore the key from
                your 24 words in Settings → Backup.
              </p>
              <Button variant="destructive" loading={busy} onClick={disconnect}>
                Disconnect
              </Button>
              <Button variant="ghost" onClick={() => setSheet(null)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </BottomSheet>
        </>
      )}
    </ScreenShell>
  )
}

function short(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
