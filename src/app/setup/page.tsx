import { redirect } from 'next/navigation'

/**
 * `/setup` was the single onboarding wizard. The flow now lives at
 * `/welcome`, `/connect`, `/privacy` and `/name`; every existing link that
 * restarts onboarding still lands here first.
 */
export default function SetupPage() {
  redirect('/welcome')
}
