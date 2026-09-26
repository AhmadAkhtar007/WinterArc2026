# Shared challenge backend implementation plan

Goal: replace challenge-specific SQL and frontend branches with validated rule configurations, immutable period snapshots, and an append-only XP ledger.

Approved design: recurring daily/weekly commitments; repeatable season attempts; amounts/occurrences/proof; target-gated or immediate rewards; proportional shortfall penalties; Mind/Body/Craft/Soul totals from the same ledger.

## Decisions
- Preserve authentication, identities, and existing data. Never reset the hosted database.
- Recurring enrollment and upgrades start next full Karachi period. One-time attempts start explicitly when added.
- Period rules and targets are snapshots. No retrospective repricing.
- Rule primitives: target choices, initial choices, entry step, burst/cooldown, cap or target multiplier, duration, rate, target bonus, target gate, reward milestones, approval, maximum penalty.
- Server validates configuration and every entry; serializes mutations per attempt; deduplicates retried entry requests and ledger settlements.
- Each closed recurring period gets round(maximum penalty * missing / target), including zero-progress periods. Scheduled maintenance catches up missed periods without user visits.
- Water schedule and penalty maximum defaults are provisional pending the user's answers. App-building stays draft until its reward is specified.

## Implementation sequence
- [x] Preserve old work in checkpoint; inspect CLI/local database.
- [x] Add two consolidated migrations: compatible identity foundation and shared engine/catalog. Verify empty database installation. Keep old history in Git, not active migrations.
- [x] Test actual SQL for reward boundaries, cooldowns, ownership, proof, repeat attempts, upgrades, missed periods and exactly-once penalties.
- [x] Connect repository and cards to server results; generic baseline picker, progress UI, admin rules editor, real category stats.
- [x] Add and run focused frontend tests, then full suite/build once for this large refactor.
- [x] Document safe existing-database migration, history reconciliation and release checks. Report any live/visual verification limitation.

## Files and boundaries
- supabase/migrations: identity and new engine only; fresh and existing database guards.
- supabase/tests/shared_challenges.sql: transactional backend behavior tests.
- src/domain/types.ts: generic rule and snapshot contracts.
- src/data/supabaseRepository.ts: thin RPC adapter, no XP calculation.
- src/pages/ChallengesPage.tsx and src/components/TrackedChallengeCard.tsx: configuration-driven controls.
- src/admin/ChallengeEditor.tsx: same rule editor for admin creation and ideas.
- docs/operations/season-runbook.md: single migration workflow and safe cutover.

Verification includes a clean PostgreSQL install and, when local tooling permits, a legacy checkpoint install upgraded to the new engine. No production deployment is implied by local verification.

Completed locally. Hosted cutover and visual QA remain release steps; neither was claimed complete. Final cleanup was not retested at user request.
