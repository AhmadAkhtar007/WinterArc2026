# v1.0 Baseline

## Purpose

This document marks the first deployable Winter Arc baseline. Future work starts from this state and should add deliberate capability without restoring removed experiments, temporary visual captures, or abandoned navigation paths.

## Product contract

- The player experience has three primary destinations: Quests, Ranks, and Profile.
- Quests opens to Daily challenges and offers Daily, Weekly, and Season views.
- Completion state is server-authoritative. Players cannot undo a completion from the client.
- Approval-required challenges remain pending until an administrator reviews proof.
- Only confirmed XP contributes to ranks.
- Command is an administrator-only surface for publishing, archiving, and reviewing challenges.
- The preview repository provides a fully interactive local mode when Supabase is not configured.

## Technical boundaries

- React 19 and TypeScript provide the client application.
- Vite builds the static PWA bundle.
- Supabase Auth, Postgres, RPCs, and RLS provide the production data boundary.
- `src/data/appRepository.ts` is the client-facing repository contract; preview and Supabase implementations stay behind it.
- SQL changes live in ordered files under `supabase/migrations/`.

## Quality gate

Before treating a change as ready, run:

```bash
npm test -- --run
npm run build
```

For database changes, also run `supabase/tests/winter_arc_core.sql` through the Supabase CLI and review the security advisor output.

## Upgrade rules

1. Start from local `main`.
2. Keep changes focused and commit successful increments.
3. Update the relevant tests and documentation with behavior changes.
4. Do not reintroduce deleted Today, open-completion, or player-created-challenge flows without an explicit product decision.
5. Keep generated browser profiles, screenshots, build output, logs, and local environment files out of Git.
6. Preserve server authority for completion, scoring, roles, and approval decisions.
