-- Restore admin review for the single designated account (Player 001 / "Legend").
--
-- The player_only_backend_hardening migration revoked EXECUTE on the review/reverse
-- RPCs, removed the admin role from every auth user, and dropped the RLS policies
-- that let an administrator read the pending queue and the reversal audit. This
-- re-enables review for exactly one account.

-- 1. Re-allow authenticated users to invoke the review RPCs. Both functions are
--    SECURITY DEFINER and enforce private.is_admin() internally, which reads the
--    JWT app_metadata.role claim, so only the account tagged as admin below
--    actually gets through; everyone else is still rejected.
grant execute on function private.review_completion(uuid, public.completion_status), private.reverse_completion(uuid, text) to authenticated;
grant execute on function public.review_completion(uuid, public.completion_status), public.reverse_completion(uuid, text) to authenticated;

-- 2. Tag only Player 001 as the administrator. This is what private.is_admin()
--    checks (via the JWT app_metadata.role claim) and what the app's own admin
--    gate (user.app_metadata.role === 'admin') reads.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = (select id from public.profiles where player_code = 'player001');

-- 3. Restore the review-queue and reversal-audit reads for the administrator.
--    The hardening migration replaced these with only "confirmed or own" reads,
--    which left the admin unable to see other players' pending submissions.
create policy "admins read review queue"
on public.completions for select to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin');

create policy "admins read reversal audit"
on public.completion_reversals for select to authenticated
using (coalesce((select auth.jwt()->'app_metadata'->>'role'), '') = 'admin');