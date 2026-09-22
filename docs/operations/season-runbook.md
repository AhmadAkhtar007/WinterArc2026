# Winter Arc Season Runbook

## Before opening access

1. Apply every migration in `supabase/migrations/` in filename order, then run the Supabase database tests and security advisors.
2. Configure the web host with HTTPS and SPA fallback.
3. Create your account, assign `app_metadata.role = admin`, and sign in again.
4. Create participant accounts or send Auth invitations.
5. Publish at least one daily challenge and confirm it appears for a test player.
6. Complete that challenge twice and confirm the second attempt is rejected.
7. Publish one approval-required challenge, submit it as a player, and confirm it remains absent from leaderboard XP until approved.

## Daily operation

- Publish, archive, and inspect challenges from **Command**.
- Review high-XP proof in the WhatsApp community, then approve or reject its pending app submission.
- Treat the app's completion and reversal history as the scoring record; do not maintain a parallel spreadsheet.
- If a player disputes a result, identify the completion before changing anything and record a reversal reason.

## Challenge rules

- Define what counts in the challenge instructions before publishing.
- Mark exceptional or externally verifiable work as approval-required.
- Never change the meaning or XP of an active challenge after players have completed it; archive it and publish a replacement.
- Daily habits use the honor system. The competition rules should state this plainly.

## Account recovery

The product has one in-app administrator, but project recovery remains available through the Supabase owner account. Protect that owner with MFA and store recovery codes offline. If the administrator account is compromised, revoke its sessions in Supabase Auth before changing metadata or credentials; deleting a user alone does not immediately invalidate already issued access tokens.

## Ending the season

After December 31 closes in `Asia/Karachi`, approve or reject every pending submission, export profiles and confirmed completions, and retain the final export as the immutable season result. Archive active challenges instead of deleting historical rows.

