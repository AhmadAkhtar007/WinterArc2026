# Winter Arc 2026

A mobile-first PWA for running the final 100 days of 2026 as a competitive challenge season. The app includes daily challenge tracking, server-authoritative XP, a confirmed-points leaderboard, administrator challenge publishing, and an approval queue for high-XP proof reviewed in WhatsApp.

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Without environment variables, the application opens in a fully interactive preview mode with representative players and challenges.

## Connect Supabase

1. Create a Supabase project.
2. Apply `supabase/migrations/202609210001_winter_arc_core.sql` through the Supabase migration workflow.
3. Copy `.env.example` to `.env.local` and supply the project URL and publishable key.
4. Create participant accounts through Supabase Auth or its invitation flow.
5. Set the sole administrator's protected app metadata to `{ "role": "admin" }`, then require that account to sign in again so its JWT refreshes. The migration synchronizes that account's game name to `Legend`; it still appears and competes on the normal leaderboard.

Never put a secret key or service-role key in a `VITE_` environment variable. Every `VITE_` value is shipped to browsers.

## Verify

```bash
npm test -- --run
npm run build
```

The SQL structural checks live at `supabase/tests/winter_arc_core.sql`. Run them through the Supabase CLI after installing it and starting or linking a project.

## Deploy

Deploy the generated `dist` directory to any HTTPS static host with SPA fallback to `index.html`. HTTPS is required for PWA installation and service workers outside localhost. Content changes in Supabase appear without reinstalling the PWA; software changes are picked up when the browser refreshes the cached application shell.

## Product boundaries

- Daily habits are honor-based.
- WhatsApp carries proof for approval-required challenges.
- Only confirmed XP affects the leaderboard.
- Player-created challenges, push notifications, an APK, and social features are intentionally excluded.
