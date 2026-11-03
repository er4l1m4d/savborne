# Progress — vault and savings loop

Plan: `docs/superpowers/plans/2026-11-02-vault-and-savings-loop.md`
Spec: `docs/superpowers/specs/2026-11-02-vault-and-savings-loop-design.md`
Mode: inline execution, one commit per task. Never run SQL. Never touch `src/app/(tabs)/page.tsx`.

| # | Task | Status | Commit |
|---|---|---|---|
| 1 | Schema | done | `20330e9` |
| 2 | Test harness | done | `e2c99db` |
| 3 | Network constants + address helpers | done | `f691a26` |
| 4 | RPC client | done | `54a41c8` |
| 5 | Testnet e2e script | done | `b52334b` |
| 6 | Streak shields | done | `e93842f` |
| 7 | POST /api/players atomic | done | `11b5836` |
| 8 | /api/vaults | done | `e51b937` |
| 9 | Transfers verify + API | done | `2642bbc` |
| 10 | Check-in reads chain | done | `7e557e2` |
| 11 | Phrase + crypto + signing | done | `0e201e9` |
| 12 | Onboarding | done | `f62743a` |
| 13 | Vault screen + guard | done | `3f494fa` |
| 14 | Receipts | done | `23ff8eb` |
| 15 | Verified-saver marker | done | `9f5d082` |
| 16 | Flex card + OG | done | `eee5fb8` |
| 17 | Tour, sound, haptics | done | `ca6c61d` |
| 18 | README, footer, cleanup | done | `06bd1e2` |

All 18 tasks are committed on `main`, each with its tests. Final gates, all green:

```
npm test            60 pass / 0 fail
npx tsc --noEmit    clean
npm run lint        0 errors, 40 pre-existing warnings
npm run build       green (no vault-spike route)
npm run vault:e2e   ALL PASS — testnet, block 15713788
```

## Outstanding (not code)

- **Schema is not confirmed applied.** The SQL is written to
  `supabase/FINAL-SCHEMA.sql` and `supabase/migrations/20261102000000_vault_and_savings_loop.sql`;
  it must be pasted into the Supabase SQL editor manually. This sandbox cannot reach the
  project host to verify (DNS does not resolve `srpygvxroalkzuwsazyg.supabase.co` here).
- **Device pass pending.** See `docs/HANDOFF-PROMPT.md` §"Vault build — device pass pending"
  for the checklist and the four unknowns to record (`sendBasicTransaction` return shape,
  `listAccounts()` first-call behaviour, `getHostNetwork()` value, WebView `sendRawTransaction`).
- **`src/app/(tabs)/page.tsx` is the user's own uncommitted work** and was never touched.
  Appendix §7 of the plan has the 6-line shield-chip snippet for them to paste once they
  commit it.

## Notes

- Task 1: also bumped the missions expectation in the verification footer 10 -> 11 (the
  plan only mentioned `rls_tables`); adding a mission makes the old number wrong.
- Task 10 folded in a schema change already staged in Task 1's migration (`has_vault` in
  `leaderboard_stats`), so Tasks 10 and 15 share one migration.
- Task 14: the receipts timeline DTOs are pure and unit-tested, so "a snapshot has no
  `txHash`/`explorerUrl`" is asserted rather than eyeballed.
- Task 17: level-up detection was extracted to `src/lib/level-up.ts` so the
  once-per-level-across-three-hook-instances invariant is unit-tested.
- Pre-existing lint warnings (40) are unchanged in character from the 37 baseline: the
  three added are the same `setState`-in-effect data-loading pattern the repo already
  carries in `usePlayerSession` and the other tab pages.

## Post-build hardening (2026-11-03)

Device-free work done after the 18 tasks, each committed and pushed:

| Work | Commit |
|---|---|
| Route-level tests: vaults, transfers, transfers/[hash], check-ins | `2252209` |
| ERRORS.md gotchas + `supabase/README.md` migration workflow | `4bc6d1a` |
| Settle expiry, race and withdrawal side-effect tests | `5713763` |

Test evidence at this point:

```
npm test            117 pass / 0 fail
npx tsc --noEmit    clean
npm run lint        0 errors, 41 warnings (pre-existing character)
npm run build       green
```

Tests for pre-existing code were mutation-tested rather than trusted: each money
guard was removed or inverted and exactly the intended test failed, then the
production file was restored byte-identical (`git diff` = 0). Guards verified this
way: card-token trust, has_vault, PATCH `.is()`, backup gate, hash ownership,
network match, hash lowercasing, player scope on `[hash]`, chain-vs-body balance,
vault address for the balance read, 120s expiry boundary, `execution_failed`, chain
fee, withdrawal side effects, missing-vault guard.

Still outstanding: the two items above (schema paste, device pass). Nothing in this
hardening changed production behaviour.
