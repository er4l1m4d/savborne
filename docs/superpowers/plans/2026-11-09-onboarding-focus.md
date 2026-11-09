# Onboarding focus pass - plan

**Spec:** `docs/superpowers/specs/2026-11-09-onboarding-focus-design.md`

## Global constraints

- Same branch; no new API or SQL.
- Foundation 2 primitives only.
- 12px floor, 44px targets, 360px no truncation.
- The 24-word phrase stays in memory.
- After every task: `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `npm run build`.
- Renders and audit for every task that changes a screen.

---

## Task 1: Five-step indicator

**Files:**
- Modify: `src/components/ui/StepBars.tsx` (add `StepLabel`)
- Modify: `src/components/onboarding/OnboardingScreen.tsx` (`total` prop)
- Modify: `src/app/(onboarding)/welcome/page.tsx`
- Modify: `src/app/(onboarding)/connect/page.tsx`
- Modify: `src/app/(onboarding)/privacy/page.tsx`
- Modify: `src/app/(onboarding)/name/page.tsx`
- Test: `src/lib/onboarding.test.ts`, `src/lib/onboarding-ui.test.ts`

- [ ] Add `StepLabel({ step, total = 5 })`: a 13px muted span with
  `aria-current="step"` and "Step N of 5".
- [ ] `OnboardingScreen` takes `total = 5`, renders `StepLabel` and
  `StepBars total={total}`.
- [ ] Welcome: brand row + `StepLabel step={1}` + `StepBars step={1} total={5}`.
- [ ] Connect: `step = stage === 'intro' || stage === 'pick' ? 2 : 3`.
- [ ] Privacy: `step={4}`. Name: `step={5}`.
- [ ] Tests pin 1-5 and the dynamic 2/3.
- [ ] Checks, welcome + connect renders, audit, commit.

---

## Task 2: Vault intro, backup and passphrase copy

**Files:**
- Create: `src/lib/onboarding-copy.ts`
- Modify: `src/app/(onboarding)/connect/page.tsx`
- Modify: `src/components/vault/PhraseCeremony.tsx`
- Modify: `src/components/vault/PassphraseField.tsx`
- Test: `src/lib/onboarding.test.ts`

- [ ] `onboarding-copy.ts` exports `VAULT_INTRO`, `VAULT_STEPS`, `VAULT_CAN`,
  `VAULT_CANNOT`, `BACKUP_RISK`, `PASSPHRASE_NOTE`, `PASSPHRASE_RESET_NOTE`,
  `BACKUP_QUIZ_NOTE`.
- [ ] Connect: remove the visible three-step panel; short intro; cards use the
  copy; add a closed `<details>` "How your vault works" with the three steps.
- [ ] PhraseCeremony: `BACKUP_RISK` (two sentences) replaces the long warning.
- [ ] PassphraseField: `PASSPHRASE_NOTE` (two sentences).
- [ ] Tests pin the two-sentence warning and the closed disclosure.
- [ ] Checks, connect phrase/lock renders, audit, commit.

---

## Task 3: Privacy two cards + disclosure

**Files:**
- Modify: `src/lib/privacy.ts` (short version, disclosure title)
- Modify: `src/components/PrivacyNotice.tsx` (`onboarding` variant, version line)
- Modify: `src/app/(onboarding)/privacy/page.tsx`
- Test: `src/lib/privacy-notice.test.ts`, `src/lib/onboarding.test.ts`

- [ ] Short version: "Savborne never holds, moves, or controls your money. We
  read your vault balance to track check-ins and streaks."
- [ ] `variant="onboarding"`: short version + collect/don't cards + closed
  "What's public and where it's stored" disclosure with the other two cards and
  the notice version.
- [ ] Privacy page uses the onboarding variant and `step={4}`.
- [ ] Full variant keeps four cards and gains the version line.
- [ ] Tests pin the visible/hidden split.
- [ ] Checks, privacy closed/open renders, audit, commit.

---

## Task 4: How Savborne works

**Files:**
- Create: `src/app/settings/how-it-works/page.tsx`
- Modify: `src/app/settings/page.tsx` (Help row)
- Test: `src/lib/settings.test.ts`, `src/lib/how-it-works.test.ts`

- [ ] Pushed screen, `backHref="/settings"`, title "How Savborne works".
- [ ] Sections: Your vault (intro, steps, cards); Backup and recovery
  (`BACKUP_RISK`, quiz note, passphrase reset); Privacy and data
  (`<PrivacyNotice variant="full" />`); Nimiq Pay (update, failed balance read).
- [ ] Settings Help gains a "How Savborne works" row.
- [ ] Tests pin the link, sections and shared copy.
- [ ] Checks, how-it-works renders, audit, commit.

---

## Task 5: Sweep, review and audit

- [ ] Full sweep: welcome; connect intro/open/picker/phrase/quiz/lock/ready;
  privacy closed/open; name/name-16/name-error; how-it-works; balance-error;
  gate preparing/outside/update.
- [ ] Audit every state at 360/390/430; final JSONL.
- [ ] Update the review page sections, images and NOTES.
- [ ] Append the focus-pass audit section.
- [ ] Final four checks; commit.
