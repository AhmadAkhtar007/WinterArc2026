# Winter Arc 2026 PWA Design

## Purpose

Winter Arc is an invite-focused, mobile-first challenge tracker for the final 100 days of 2026. One administrator publishes official challenges. Players record daily progress, receive server-authoritative points, and compete on a confirmed-points leaderboard. High-value proof stays in the parallel WhatsApp community; the administrator approves or reverses those completions in the app.

## Season rules

- The season runs from 2026-09-23 through 2026-12-31, inclusive.
- Competitive deadlines use `Asia/Karachi`.
- Daily habits use the honor system.
- Official challenges award competitive points; personal challenges are outside the first release.
- High-value challenges create pending completions and award points only after administrator approval.
- Streaks are motivational and do not multiply points.
- Points are copied onto completion records so later challenge changes cannot rewrite history.
- A player can receive credit only once per challenge period.

## First-release experience

The player application has four primary destinations:

1. **Today** — season progress, current score and rank, today's challenge list, completion controls, and the nearest competitor.
2. **Challenges** — active daily, weekly, and season challenges with rules, points, and status.
3. **Leaderboard** — confirmed points, rank movement context, and completion counts.
4. **Profile** — player identity, streak, season completion heatmap, and sign-out.

The protected administrator view creates and archives challenges, reviews pending high-value completions, reverses invalid completions with a reason, and sees player standings.

## Visual direction

The product uses cinematic editorial luxury rather than a conventional SaaS dashboard: OLED black, bone white, smoked silver, glacial blue, and rare ember orange. High-contrast editorial serif display type pairs with a restrained geometric sans. Atmospheric winter imagery, fixed low-opacity grain, concentric card radii, hairline highlights, generous negative space, and tactile motion create prestige without sacrificing legibility or mobile performance.

Motion is brief and purposeful: staggered entry, physical button press, progress interpolation, and a restrained completion glow. Reduced-motion preferences disable nonessential movement. Touch targets remain at least 44px and foreground contrast meets WCAG AA.

## Technical architecture

- React, TypeScript, and Vite provide the single-page application.
- The application is installable as a PWA through a web manifest and service worker.
- Supabase provides email/password authentication and Postgres persistence.
- Row-level security protects every exposed table.
- A database function records completions, calculates the period key in `Asia/Karachi`, copies the challenge points, and rejects duplicate awards.
- The client never inserts awarded points directly.
- When Supabase environment variables are absent, a clearly labelled local preview mode supplies representative data so the visual product remains reviewable.

## Data model

### profiles

`id`, `display_name`, `avatar_seed`, `created_at`

### challenges

`id`, `title`, `description`, `frequency`, `points`, `requires_approval`, `starts_on`, `ends_on`, `created_by`, `archived_at`, `created_at`

### completions

`id`, `user_id`, `challenge_id`, `period_key`, `points_awarded`, `status`, `completed_at`, `reviewed_at`, `reviewed_by`

### completion_reversals

`id`, `completion_id`, `reversed_by`, `reason`, `created_at`

The database enforces uniqueness across `(user_id, challenge_id, period_key)` and treats reversed completions as historical records rather than deleting them.

## Security boundaries

- Administrator authorization comes from protected `app_metadata`, never editable user metadata.
- Players can read active official challenges, public profile fields, and leaderboard-safe completion data.
- Players can read their own full completion history.
- Only the completion function may create scored completions.
- Only the administrator can create challenges, approve pending completions, or reverse points.
- No service-role credential is shipped to the browser.
- Authentication, authorization, uniqueness, and input limits are enforced in the database rather than trusted to the interface.

## Explicit exclusions

The first release excludes an APK, public community challenges, social feeds, direct messages, wearable integrations, proof uploads, push notifications, realtime subscriptions, streak bonuses, levels, badges, private leagues, and multiple leaderboard formulas.

## Acceptance criteria

- A player can authenticate, view active challenges, record an eligible completion, and see confirmed points reflected in the leaderboard.
- Duplicate completion attempts cannot award points twice.
- Approval-required completions remain pending until reviewed by the administrator.
- A player cannot change scores, challenge definitions, other profiles, or review state.
- The interface is usable as an installed PWA on modern iOS and Android browsers.
- The core interface remains reviewable in local preview mode before Supabase credentials are connected.

