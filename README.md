# Winter Arc 2026

A React PWA backed by one configuration-driven Supabase challenge engine.

## Development

Node.js 22.13 or newer. Run `npm install`, configure `.env.local` from `.env.example`, then `npm run dev`.

## Backend

There are two migrations: identity foundation and shared challenge engine. The initial 15 challenges are included in the engine migration. New challenges and user ideas are configured in **Command**, without SQL.

Rules cover daily/weekly commitments, repeatable season attempts, selectable baselines, amounts/occurrences/submissions, cooldowns, deadlines, bonus caps, proof approval, and proportional penalties. Backend-calculated XP drives rankings and Body/Mind/Soul/Craft stats.

**Existing installations must follow [the cutover runbook](docs/operations/season-runbook.md).** Do not reset a hosted database or blindly replay the consolidated migrations.

## Verification

- `npm test -- --run --pool=forks --maxWorkers=1`
- `npm run build`
- Start local Supabase with `npx supabase db start`, then run `node scripts/test-backend.mjs`.
- `npx supabase db advisors --local --type all --level warn --fail-on error`

Keep service-role keys out of all `VITE_` variables. Deploy the built frontend and matching backend together.
