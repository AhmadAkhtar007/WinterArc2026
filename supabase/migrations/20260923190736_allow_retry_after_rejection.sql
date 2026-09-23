ALTER TABLE public.completions
  DROP CONSTRAINT completions_user_id_challenge_id_period_key_key;

CREATE UNIQUE INDEX completions_active_period_unique
  ON public.completions (user_id, challenge_id, period_key)
  WHERE status <> 'reversed';
