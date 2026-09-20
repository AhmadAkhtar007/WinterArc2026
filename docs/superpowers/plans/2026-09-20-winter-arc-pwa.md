# Winter Arc 2026 PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium mobile-first PWA where an administrator publishes Winter Arc challenges and players earn server-authoritative points on a leaderboard.

**Architecture:** A React/Vite client renders authenticated player and administrator flows. Supabase Auth and Postgres provide persistence; RLS and narrow database functions own authorization and scoring. A local preview adapter keeps visual development and review independent of backend credentials.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Supabase JavaScript client, handwritten PWA manifest and service worker, CSS modules/global CSS

**Spec:** `docs/superpowers/specs/2026-09-20-winter-arc-pwa-design.md`

## Global Constraints

- Season dates are `2026-09-23` through `2026-12-31`, inclusive.
- Competitive timezone is `Asia/Karachi`.
- The browser never receives a Supabase service-role key.
- Scoring is calculated by the database, not trusted to the client.
- The initial release has no realtime, proof upload, push notification, or APK dependency.
- The interface meets 44px touch targets, WCAG AA contrast, and reduced-motion preferences.
- Visual language is OLED editorial luxury: obsidian, bone, smoked silver, glacial blue, and rare ember.

---

### Task 1: Application foundation and preview contract

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/domain/types.ts`
- Create: `src/data/appRepository.ts`
- Create: `src/data/previewRepository.ts`
- Create: `src/test/setup.ts`
- Test: `src/data/previewRepository.test.ts`

**Interfaces:**
- Produces: `AppRepository` with `getDashboard()`, `getChallenges()`, `getLeaderboard()`, `completeChallenge(challengeId)`, and `signOut()`.
- Produces: typed `Challenge`, `Completion`, `LeaderboardEntry`, and `DashboardSnapshot` records.

- [ ] Write a repository test that loads the preview dashboard, completes an eligible daily challenge, and rejects a second completion for the same period.
- [ ] Run `npm test -- --run src/data/previewRepository.test.ts` and confirm it fails because the repository does not exist.
- [ ] Create the minimal Vite application, shared domain types, repository interface, and in-memory preview repository.
- [ ] Run the repository test and confirm it passes.
- [ ] Run `npm run build` and confirm TypeScript and Vite succeed.

### Task 2: Premium mobile application shell

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/global.css`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/navigation.ts`
- Create: `src/components/BrandMark.tsx`
- Create: `src/components/BottomNavigation.tsx`
- Create: `src/components/ProgressRing.tsx`
- Create: `src/components/ChallengeCard.tsx`
- Create: `src/pages/TodayPage.tsx`
- Create: `src/pages/ChallengesPage.tsx`
- Create: `src/pages/LeaderboardPage.tsx`
- Create: `src/pages/ProfilePage.tsx`
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `AppRepository` and domain records from Task 1.
- Produces: navigable `AppShell` and the four player destinations.

- [ ] Write an application test proving Today loads, a challenge can be completed once, and navigation reaches Leaderboard.
- [ ] Run `npm test -- --run src/app/App.test.tsx` and confirm it fails before UI implementation.
- [ ] Implement the cinematic shell, responsive page layouts, challenge state, leaderboard, profile heatmap, loading state, error state, and reduced-motion styling.
- [ ] Run the application test and confirm it passes.
- [ ] Run `npm run build` and inspect the mobile layout at 390px and desktop layout at 1440px.

### Task 3: Installable PWA behavior

**Files:**
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/icon.svg`
- Create: `src/pwa/registerServiceWorker.ts`
- Modify: `index.html`
- Modify: `src/main.tsx`
- Test: `src/pwa/registerServiceWorker.test.ts`

**Interfaces:**
- Produces: `registerServiceWorker(): void` and a standards-based installable manifest.

- [ ] Write a test proving service-worker registration is attempted only in production when the API is supported.
- [ ] Run the focused test and confirm it fails before implementation.
- [ ] Add the manifest, vector application icon, minimal app-shell cache, and guarded registration function.
- [ ] Run the focused test and confirm it passes.
- [ ] Build the application and verify the manifest, theme color, display mode, and service worker are present in `dist`.

### Task 4: Supabase schema and secure scoring

**Files:**
- Create: `supabase/migrations/202609200001_winter_arc_core.sql`
- Create: `supabase/tests/winter_arc_core.sql`
- Create: `.env.example`

**Interfaces:**
- Produces: `profiles`, `challenges`, `completions`, and `completion_reversals` tables.
- Produces: RPC functions `complete_challenge(uuid)`, `review_completion(uuid, completion_status)`, and `reverse_completion(uuid, text)`.

- [ ] Write SQL assertions for RLS enablement, duplicate-period rejection, pending approval behavior, confirmed scoring, and player/admin authorization.
- [ ] Create the minimal schema, constraints, indexes, policies, and RPC functions in a single migration.
- [ ] Run the Supabase database tests against the local stack when the CLI is available; otherwise validate the migration with a PostgreSQL parser and record the unavailable integration check.
- [ ] Run Supabase security advisors when connected and resolve any exposed-table, mutable-search-path, or privilege findings.

### Task 5: Supabase client adapter and authentication

**Files:**
- Create: `src/data/supabaseClient.ts`
- Create: `src/data/supabaseRepository.ts`
- Create: `src/auth/AuthPage.tsx`
- Create: `src/auth/useSession.ts`
- Modify: `src/app/App.tsx`
- Modify: `src/domain/types.ts`
- Test: `src/data/supabaseRepository.test.ts`
- Test: `src/auth/AuthPage.test.tsx`

**Interfaces:**
- Consumes: Supabase RPC and table contracts from Task 4.
- Produces: `SupabaseRepository` implementing `AppRepository` and session-aware application routing.

- [ ] Write tests with a small mocked Supabase boundary for login error display, dashboard mapping, RPC completion, and sign-out.
- [ ] Run the focused tests and confirm they fail before implementation.
- [ ] Implement environment validation, authenticated repository calls, email/password login, session restoration, and automatic preview-mode selection when credentials are absent.
- [ ] Run the focused tests and confirm they pass.
- [ ] Run the full test suite and production build.

### Task 6: Administrator workflow

**Files:**
- Create: `src/admin/AdminPage.tsx`
- Create: `src/admin/ChallengeEditor.tsx`
- Create: `src/admin/ReviewQueue.tsx`
- Modify: `src/data/appRepository.ts`
- Modify: `src/data/previewRepository.ts`
- Modify: `src/data/supabaseRepository.ts`
- Modify: `src/app/navigation.ts`
- Modify: `src/app/AppShell.tsx`
- Test: `src/admin/AdminPage.test.tsx`

**Interfaces:**
- Extends: `AppRepository` with `createChallenge(input)`, `archiveChallenge(id)`, `getPendingCompletions()`, `reviewCompletion(id, decision)`, and `reverseCompletion(id, reason)`.
- Produces: an administrator-only destination guarded by both interface state and database authorization.

- [ ] Write tests proving administrators can create a challenge and approve a pending completion while normal players never receive the admin destination.
- [ ] Run the focused tests and confirm they fail before implementation.
- [ ] Implement the compact challenge editor, review queue, archive action, and reversal dialog.
- [ ] Run the focused tests and confirm they pass.
- [ ] Run all tests and the production build.

### Task 7: Verification and launch handoff

**Files:**
- Create: `README.md`
- Create: `docs/operations/season-runbook.md`
- Modify: any file implicated by verification failures

**Interfaces:**
- Produces: reproducible local setup, Supabase connection steps, admin bootstrap instructions, PWA deployment guidance, and daily season operations.

- [ ] Run `npm test -- --run` and retain a passing result.
- [ ] Run `npm run build` and retain a passing result.
- [ ] Inspect the production UI at 390px, 768px, and 1440px; correct clipping, weak contrast, inaccessible focus, and reduced-motion failures.
- [ ] Verify offline app-shell loading after one successful visit while ensuring challenge mutations still require connectivity.
- [ ] Document environment setup, migration application, protected admin metadata bootstrap, deployment, recovery, and point-reversal operations.

