# Tracked Daily Challenges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add quantity and scheduled-occurrence daily challenge cards with server-validated progress, reward tiers, cooldown overlays, correction, local-day reset, and representative backend data.

**Architecture:** Extend the challenge read model with a tracking configuration and derived current-period progress. Store each progress action as a row and mutate it only through authenticated RPCs. Render binary challenges with the existing card and tracked challenges with a dedicated component and logging/details sheets.

**Tech Stack:** React 19, TypeScript, CSS, Supabase/PostgreSQL, Vite.

**Spec:** `docs/superpowers/specs/2026-09-22-tracked-daily-challenges-design.md`

## Global Constraints

- Add no dependencies.
- Daily period keys come from the device and must be within one day of server UTC.
- Keep the current card as the binary variant.
- Defer new automated tests at the user's request; run TypeScript/Vite build verification after implementation.
- Do not implement weekly, season, marketplace, penalties, or admin rule-building.

---

### Task 1: Domain and repository contracts

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/data/appRepository.ts`

**Interfaces:**
- Produce `ChallengeTrackingMode`, `RewardTier`, `ProgressEntry`, tracked fields on `Challenge`, `recordChallengeProgress`, and `removeChallengeProgressEntry`.

- [ ] Add typed tracking configuration, derived progress, cooldown, and entry history fields.
- [ ] Add repository mutations accepting a device-local `periodKey`.

### Task 2: Preview repository behavior and seeded challenges

**Files:**
- Modify: `src/data/previewRepository.ts`

**Interfaces:**
- Consume the domain and repository contracts from Task 1.
- Produce hydration, push-up, reading, and Salah examples with in-memory entry validation and derived progress.

- [ ] Replace representative daily rows with configured binary, quantity, and occurrence challenges.
- [ ] Validate increments, current period, duplicate/interval rules, and reward thresholds.
- [ ] Derive progress, secured XP, cooldown expiry, completion, and leaderboard totals from entries.
- [ ] Support current-day entry removal and recalculation.

### Task 3: Tracked card and sheets

**Files:**
- Create: `src/components/TrackedChallengeCard.tsx`
- Modify: `src/pages/ChallengesPage.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consume tracked `Challenge` fields and repository mutation callbacks.
- Produce quantity/occurrence logging, current-day entry correction, cooldown countdown, and automatic midnight refresh.

- [ ] Route binary challenges to `ChallengeCard` and tracked challenges to `TrackedChallengeCard`.
- [ ] Implement the approved compact progress layout and entry logging sheet.
- [ ] Implement the blurred cooldown overlay with centred timer and accessible label.
- [ ] Implement the card details/history sheet with current-day correction.
- [ ] Schedule refresh at device-local midnight and when cooldown expires.

### Task 4: Supabase schema, RPCs, and read model

**Files:**
- Create: `supabase/migrations/*_tracked_daily_challenges.sql`
- Modify: `src/data/supabaseRepository.ts`
- Modify: `supabase/tests/winter_arc_core.sql`

**Interfaces:**
- Produce tracking configuration columns, reward-tier JSON, `challenge_progress_entries`, authenticated record/remove RPCs, and tracked fields from `player_challenges`.

- [ ] Add tracking columns and a progress-entry table with RLS and explicit grants.
- [ ] Add private security-definer mutation functions with pinned search paths, caller ownership checks, local-period sanity checks, increment validation, and interval validation.
- [ ] Add public security-invoker wrappers with explicit authenticated grants and anon revocations.
- [ ] Extend `player_challenges` to return configuration and derived current-period progress.
- [ ] Map the new RPCs and read fields in `supabaseRepository.ts`.

### Task 5: Populate representative challenges and verify

**Files:**
- Modify: `supabase/seed.sql`
- Modify: `supabase/migrations/*_tracked_daily_challenges.sql`

**Interfaces:**
- Produce repeatable local seed data and an idempotent upgrade for existing challenge rows.

- [ ] Seed hydration, push-ups, nonfiction reading tiers, and five daily Salah occurrences.
- [ ] Configure existing matching rows during migration without duplicating challenges.
- [ ] Run `npm run build` and `git diff --check`.
- [ ] Report that live visual QA is reserved for the user and identify whether the local or hosted Supabase backend was populated.