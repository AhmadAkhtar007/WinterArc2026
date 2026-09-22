# Winter Arc 2026

Winter Arc is a mobile-first PWA for the final 100 days of 2026. Players complete daily, weekly, and season challenges; confirmed XP powers the ranks; exceptional work can require proof reviewed through WhatsApp.

This repository is the local v1.0 baseline. See [docs/v1-baseline.md](docs/v1-baseline.md) for the boundaries and upgrade rules that apply from here onward.

## Development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Without environment variables, the app runs in an interactive preview mode with representative players and challenges.

## Verification

```bash
npm test -- --run
npm run build
```

SQL structural checks live in `supabase/tests/winter_arc_core.sql` and should be run through the Supabase CLI after the project is started or linked.

## Supabase setup

1. Create a Supabase project.
2. Apply every file in `supabase/migrations/` in filename order.
3. Copy `.env.example` to `.env.local` and provide the project URL and publishable key.
4. Create participant accounts through Supabase Auth or its invitation flow.
5. Set the administrator's protected app metadata to `{ "role": "admin" }`, then require a fresh sign-in so its JWT includes the updated metadata.

Never put a secret key or service-role key in a `VITE_` environment variable. Every `VITE_` value is shipped to browsers.

## Deployment

Deploy `dist` to an HTTPS static host with SPA fallback to `index.html`. HTTPS is required for PWA installation and service workers outside localhost.

## Product boundaries

- Daily habits are honor-based.
- WhatsApp carries proof for approval-required challenges.
- Only confirmed XP affects the leaderboard.
- Player-created challenges, push notifications, APK packaging, and social features are intentionally out of scope.
