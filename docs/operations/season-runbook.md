# Winter Arc shared backend

## Current release state

Built on branch `codex/shared-challenge-backend`. The previous work and all 22 old migrations are preserved in checkpoint commit `56a6181`. Only two replacement migrations remain active. Deployed both migrations to hosted Supabase project chqrbyinfmiznqbsucop on 2026-09-26. Schema, data and migration history backups are stored locally in ignored supabase/.temp/pre-upgrade-schema.sql and pre-upgrade-data.sql. Retired history records were reconciled; hosted history now contains the two replacement migrations. Post-deployment checks confirmed 12 profiles, all 112 legacy XP preserved with zero per-player mismatches, 15 published challenges, seven active imported commitments, no pending proofs, and a successful settlement Cron run. The matching frontend still needs deployment. No additional app tests were run.

The local installation, SQL behavior tests, legacy upgrade rehearsal, 45 frontend tests, production build, and Supabase advisors passed during development. Browser inspection was unavailable. Final cleanup was not retested at the user's request.

## Everyday administration

Use **Command** to create/edit challenges, configure and publish suggestions, and approve proof. Existing commitments retain their saved rules; edits apply to new commitments. Unpublish a challenge to prevent new enrollments without erasing existing history.

Players choose a baseline when joining. Recurring commitments and upgrades begin next full Karachi day/week. Upgrades preserve earlier targets and XP. The final incomplete week does not create an obligation. Adding a timed season challenge starts its countdown; finished or expired attempts can be added again.

Progress is append-only. Only backend functions can record progress, award XP, review proof or publish challenges. Proof remains in WhatsApp, with its review recorded in the app.

## Scoring decisions

- Water: 500 ml entries; baseline choices 2.5/3/3.5/4 L; rewards 8/10/13/16 XP; XP unlocks at the chosen baseline; 30-minute cooldown after each three entries.
- Pushups: initial 50/100; upgrades 150/200; one XP per ten reps after baseline, cap twice baseline.
- Pullups: 8/20, upgrade 8 to 20; rewards 5/12, proportional extra reps rounded down, cap twice baseline.
- Salah: five XP per prayer, five daily, 60-minute cooldown.
- Gym: ten XP per session plus one 50 XP baseline bonus; cap seven; 12-hour cooldown.
- Reading: eight pages unlock ten XP; typed page amounts.
- Squats: 1,000 within 24 hours unlock 100 XP; no partial reward or penalty.
- Proof challenges: 5K 100; half-marathon 500; full-marathon 1,000; digital-product sales 100/1,000; service deals 500/1,000; app-building 500.

Recurring penalties are rounded whole XP: baseline reward multiplied by the unfinished fraction. Previously earned partial rewards remain separate. The `winter-arc-settle` database job runs every minute, catches up missed periods, and records each penalty only once. Check its successful runs in Supabase Cron.

## Safe hosted cutover

1. Back up the hosted database and its migration history. Capture actual schema, account totals, commitments, pending proofs and ideas. This is necessary because the live database may contain manually applied changes.
2. Restore that backup into an isolated staging project and rehearse these two migrations. The local rehearsal covered the checkpoint schema, not unknown hosted drift.
3. Compare imported balances and pending records before deploying. Known recurring commitments restart next full period under the new rules. Legacy XP becomes an explicitly uncategorized opening balance; original tables remain preserved and their old API write permissions are revoked.
4. Review imported draft challenges. Unknown legacy definitions are deliberately unpublished and need admin classification/configuration. Open season attempts without pending proof are restarted through the new catalog; their old records remain in the legacy tables.
5. Reconcile migration history only after the rehearsal. Inspect `npx supabase migration list --linked`. If it contains retired versions, use `npx supabase migration repair --linked --status reverted <retired versions>` for exactly those versions, retaining the history backup. This changes the tracking records, not the underlying old tables. Do not mark new migrations applied before executing them.
6. Coordinate a maintenance window: the new migration revokes old write endpoints. Apply with `npx supabase db push`, then deploy the matching frontend. Never use `db reset --linked`.
7. Confirm preserved totals, proof queues, identities, new challenge publishing, and successful Cron execution. Run advisors and perform the outstanding mobile/browser review.

Do not roll back by simply deploying the old frontend after cutover. Restore the coordinated database backup and frontend together if rollback is necessary, accounting for any new activity first.

## Data ownership

`arc_challenges`: admin catalog and rules.
`arc_commitments`: player baselines and saved rules.
`arc_periods`: immutable period/attempt rules and progress state.
`arc_entries`: deduplicated progress records.
`arc_xp`: reward/penalty history used by rankings and category stats.
`arc_ideas`: suggestions and review decisions.
`profiles` and Supabase Auth retain existing identities.

The backend exposes guarded RPCs; direct player writes to engine tables are denied. Browser code displays server-calculated XP rather than duplicating scoring formulas.

## Future changes

Ordinary catalog edits go through Command. Change shared mechanics only when a new rule cannot express the requirement, and add a migration for that structural change. Do not create a migration for each challenge.
