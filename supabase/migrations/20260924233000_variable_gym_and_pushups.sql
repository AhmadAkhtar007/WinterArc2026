-- ====================================================================
-- WINTER ARC 2026: EXACT SCHEMA-MAPPED MIGRATION FOR GYM & PUSHUPS
-- Mapped strictly to existing public.challenges & public.challenge_commitments
-- ====================================================================

-- 1. FIX FOREIGN KEY CONSTRAINT TO CASCADE ON CHALLENGE DELETION
ALTER TABLE public.challenge_commitments
  DROP CONSTRAINT IF EXISTS challenge_commitments_challenge_id_fkey,
  ADD CONSTRAINT challenge_commitments_challenge_id_fkey
    FOREIGN KEY (challenge_id)
    REFERENCES public.challenges(id)
    ON DELETE CASCADE;

-- 2. ADD CUSTOM_TARGET COLUMN TO COMMITMENTS TABLE
ALTER TABLE public.challenge_commitments
  ADD COLUMN IF NOT EXISTS custom_target integer;

-- 3. DROP EXISTING FUNCTIONS (PREVENTS POSTGRES ERROR 42P13)
DROP FUNCTION IF EXISTS public.enroll_challenge(uuid, integer);
DROP FUNCTION IF EXISTS public.enroll_challenge(uuid);
DROP FUNCTION IF EXISTS private.enroll_challenge(uuid, integer);
DROP FUNCTION IF EXISTS private.enroll_challenge(uuid);
DROP FUNCTION IF EXISTS public.upgrade_challenge_target(uuid, integer);
DROP FUNCTION IF EXISTS private.upgrade_challenge_target(uuid, integer);

-- 4. RECREATE ENROLL_CHALLENGE RPC WITH EXACT EXISTING PARAMETER NAMES
CREATE OR REPLACE FUNCTION private.enroll_challenge(
  target_challenge_id uuid,
  target_goal integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  target public.challenges;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode = '28000'; END IF;

  SELECT * INTO target FROM public.challenges
  WHERE id = target_challenge_id AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found' USING errcode = 'P0002'; END IF;

  IF current_date < target.starts_on OR current_date > target.ends_on THEN
    RAISE EXCEPTION 'Challenge is not currently available' USING errcode = '22023';
  END IF;

  INSERT INTO public.challenge_commitments (user_id, challenge_id, custom_target)
  VALUES (caller_id, target_challenge_id, target_goal)
  ON CONFLICT (user_id, challenge_id)
  DO UPDATE SET custom_target = COALESCE(EXCLUDED.custom_target, public.challenge_commitments.custom_target);
END;
$$;

CREATE OR REPLACE FUNCTION public.enroll_challenge(
  target_challenge_id uuid,
  target_goal integer DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.enroll_challenge(target_challenge_id, target_goal);
$$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.enroll_challenge(uuid, integer), public.enroll_challenge(uuid, integer) TO authenticated;

-- 5. CREATE UPGRADE_CHALLENGE_TARGET RPC (ONE-WAY RATCHET: CAN ONLY INCREASE)
CREATE OR REPLACE FUNCTION private.upgrade_challenge_target(
  target_challenge_id uuid,
  new_target integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  current_target integer;
  challenge_rec public.challenges;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode = '28000'; END IF;

  SELECT * INTO challenge_rec FROM public.challenges WHERE id = target_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found' USING errcode = 'P0002'; END IF;

  SELECT custom_target INTO current_target
  FROM public.challenge_commitments
  WHERE user_id = caller_id AND challenge_id = target_challenge_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Not committed to this challenge' USING errcode = 'P0002'; END IF;

  IF new_target <= COALESCE(current_target, challenge_rec.tracking_target, 0) THEN
    RAISE EXCEPTION 'Target can only be increased, never lowered' USING errcode = '22023';
  END IF;

  UPDATE public.challenge_commitments
  SET custom_target = new_target
  WHERE user_id = caller_id AND challenge_id = target_challenge_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upgrade_challenge_target(
  target_challenge_id uuid,
  new_target integer
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.upgrade_challenge_target(target_challenge_id, new_target);
$$;

GRANT EXECUTE ON FUNCTION private.upgrade_challenge_target(uuid, integer), public.upgrade_challenge_target(uuid, integer) TO authenticated;

-- 6. SAFELY UPDATE CHALLENGE CATALOG (GYM & PUSHUPS)
-- Update Gym challenge without deleting or breaking foreign keys
UPDATE public.challenges
SET title = 'Gym',
    description = 'Commit to your weekly training split. 10 XP per session plus 50 XP completion bonus when you hit your weekly goal.',
    points = 50,
    tracking_mode = 'occurrence',
    tracking_unit = 'sessions',
    tracking_target = 4,
    entry_options = array[1],
    entry_step = 1,
    burst_limit = 1,
    minimum_interval_minutes = 720,
    reward_tiers = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000006'
   OR (frequency = 'weekly' AND lower(title) = 'gym');

-- Update Pushups challenge
UPDATE public.challenges
SET title = 'Pushups',
    description = 'Daily pushups. Earn +1 XP per 10 reps, with a bonus cap of double your baseline.',
    points = 10,
    tracking_mode = 'quantity',
    tracking_unit = 'reps',
    tracking_target = 100,
    entry_options = '{}',
    entry_step = null,
    burst_limit = 1,
    minimum_interval_minutes = 0,
    reward_tiers = '[]'::jsonb
WHERE id = '10000000-0000-4000-8000-000000000002'
   OR (frequency = 'daily' AND lower(title) IN ('100 pushups', '100 push-ups', '100 pushups per day', 'pushups'));

-- 7. UPDATE RECORD_CHALLENGE_PROGRESS TO RESPECT CUSTOM_TARGET & DOUBLE BONUS CAP
CREATE OR REPLACE FUNCTION private.record_challenge_progress(
  target_challenge_id uuid,
  entry_amount integer,
  target_period_key text
)
RETURNS public.challenge_progress_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  target public.challenges;
  requested_date date := private.valid_local_period(target_period_key);
  period text;
  latest_entry timestamptz;
  first_entry timestamptz;
  current_progress integer;
  entry_count integer;
  created public.challenge_progress_entries;
  user_target integer;
  effective_target integer;
  max_progress_limit integer;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode = '28000'; END IF;

  SELECT * INTO target FROM public.challenges WHERE id = target_challenge_id AND archived_at IS NULL FOR SHARE;
  IF NOT FOUND OR target.frequency NOT IN ('daily', 'weekly') OR target.tracking_mode = 'binary' THEN
    RAISE EXCEPTION 'Tracked challenge not found' USING errcode = 'P0002';
  END IF;

  IF requested_date < target.starts_on OR requested_date > target.ends_on THEN
    RAISE EXCEPTION 'Challenge is outside its active window' USING errcode = '22023';
  END IF;

  IF entry_amount <= 0 THEN RAISE EXCEPTION 'Progress must be a positive whole number' USING errcode = '22023'; END IF;
  IF target.entry_step IS NOT NULL AND entry_amount <> target.entry_step THEN RAISE EXCEPTION 'Progress must use the configured step' USING errcode = '22023'; END IF;
  IF target.tracking_mode = 'occurrence' AND entry_amount <> 1 THEN RAISE EXCEPTION 'Occurrence challenges record one completion at a time' USING errcode = '22023'; END IF;

  period := CASE target.frequency
    WHEN 'daily' THEN target_period_key
    WHEN 'weekly' THEN to_char(requested_date, 'IYYY-"W"IW')
    ELSE '2026-season'
  END;

  SELECT min(recorded_at), max(recorded_at), coalesce(sum(amount), 0)::integer, count(*)::integer
  INTO first_entry, latest_entry, current_progress, entry_count
  FROM public.challenge_progress_entries
  WHERE user_id = caller_id AND challenge_id = target_challenge_id AND period_key = period;

  IF latest_entry IS NOT NULL
     AND entry_count % target.burst_limit = 0
     AND now() < latest_entry + make_interval(mins => target.minimum_interval_minutes) THEN
    RAISE EXCEPTION 'Challenge is still in cooldown' USING errcode = '22023';
  END IF;

  -- Determine effective target and maximum allowed progress limit
  SELECT custom_target INTO user_target
  FROM public.challenge_commitments
  WHERE user_id = caller_id AND challenge_id = target_challenge_id;

  effective_target := COALESCE(user_target, target.tracking_target, 1);

  IF lower(target.title) LIKE '%pushup%' OR lower(target.title) LIKE '%push-up%' THEN
    -- Pushups cap bonus reps at double the committed baseline
    max_progress_limit := effective_target * 2;
  ELSE
    max_progress_limit := effective_target;
  END IF;

  IF current_progress >= max_progress_limit OR current_progress + entry_amount > max_progress_limit THEN
    RAISE EXCEPTION 'Entry exceeds allowed maximum progress' USING errcode = '22023';
  END IF;

  INSERT INTO public.challenge_progress_entries (user_id, challenge_id, period_key, amount)
  VALUES (caller_id, target_challenge_id, period, entry_amount)
  RETURNING * INTO created;
  RETURN created;
END;
$$;

-- 8. UPDATE PLAYER_CHALLENGES FUNCTION
CREATE OR REPLACE FUNCTION private.player_challenges(target_period_key text)
RETURNS TABLE (
  id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  requested_date date := private.valid_local_period(target_period_key);
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode = '28000'; END IF;
  RETURN QUERY
  SELECT
    challenge.id,
    challenge.title,
    challenge.description,
    challenge.frequency,
    CASE
      WHEN lower(challenge.title) = 'gym' THEN
        (COALESCE(commitment.custom_target, challenge.tracking_target, 4) * 10) + 50
      WHEN lower(challenge.title) LIKE '%pushup%' OR lower(challenge.title) LIKE '%push-up%' THEN
        (COALESCE(commitment.custom_target, challenge.tracking_target, 100) / 10)
      ELSE challenge.points
    END as points,
    challenge.requires_approval,
    challenge.starts_on,
    challenge.ends_on,
    challenge.archived_at,
    completion.id,
    completion.period_key,
    completion.points_awarded,
    completion.status,
    completion.completed_at,
    challenge.tracking_mode,
    challenge.tracking_unit,
    COALESCE(commitment.custom_target, challenge.tracking_target) as tracking_target,
    challenge.entry_options,
    challenge.entry_step,
    challenge.burst_limit,
    challenge.minimum_interval_minutes,
    challenge.attempt_duration_minutes,
    challenge.reward_tiers,
    entry_state.total,
    CASE
      WHEN lower(challenge.title) LIKE '%pushup%' OR lower(challenge.title) LIKE '%push-up%' THEN
        (LEAST(entry_state.total, COALESCE(commitment.custom_target, challenge.tracking_target, 100) * 2) / 10)
      WHEN lower(challenge.title) = 'gym' THEN
        (LEAST(entry_state.total, COALESCE(commitment.custom_target, challenge.tracking_target, 4)) * 10) +
        (CASE WHEN entry_state.total >= COALESCE(commitment.custom_target, challenge.tracking_target, 4) THEN 50 ELSE 0 END)
      ELSE
        coalesce((select max((tier->>'points')::integer) from jsonb_array_elements(challenge.reward_tiers) tier where entry_state.total >= (tier->>'threshold')::integer), 0)
    END as secured_points,
    case when entry_state.latest is not null and entry_state.entry_count % challenge.burst_limit = 0
      then entry_state.latest + make_interval(mins => challenge.minimum_interval_minutes) else null end,
    case when entry_state.first_entry is not null and challenge.attempt_duration_minutes is not null
      and entry_state.total < COALESCE(commitment.custom_target, challenge.tracking_target)
      then entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes) else null end,
    case when entry_state.first_entry is not null and challenge.attempt_duration_minutes is not null
      and entry_state.total < COALESCE(commitment.custom_target, challenge.tracking_target)
      and now() >= entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes)
      then true else false end,
    entry_state.entries
  FROM public.challenges challenge
  LEFT JOIN public.challenge_commitments commitment
    ON commitment.challenge_id = challenge.id AND commitment.user_id = caller_id
  LEFT JOIN public.completions completion
    ON completion.challenge_id = challenge.id AND completion.user_id = caller_id AND completion.status <> 'reversed'
   AND completion.period_key = CASE challenge.frequency
     WHEN 'daily' THEN target_period_key
     WHEN 'weekly' THEN to_char(requested_date, 'IYYY-"W"IW')
     ELSE '2026-season' END
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(item.amount), 0)::integer as total, min(item.recorded_at) as first_entry,
      max(item.recorded_at) as latest, count(item.id)::integer as entry_count,
      coalesce(jsonb_agg(jsonb_build_object('id', item.id, 'amount', item.amount, 'recordedAt', item.recorded_at) order by item.recorded_at) filter (where item.id is not null), '[]'::jsonb) as entries
    FROM public.challenge_progress_entries item
    WHERE item.user_id = caller_id AND item.challenge_id = challenge.id
      AND item.period_key = CASE challenge.frequency
        WHEN 'daily' THEN target_period_key
        WHEN 'weekly' THEN to_char(requested_date, 'IYYY-"W"IW')
        ELSE '2026-season' END
  ) entry_state ON true
  WHERE challenge.archived_at IS NULL AND requested_date BETWEEN challenge.starts_on AND challenge.ends_on
  ORDER BY challenge.points, challenge.created_at, challenge.id;
END;
$$;

-- 9. UPDATE PLAYER_LEADERBOARD FOR VARIABLE GYM & PUSHUPS SCORING
CREATE OR REPLACE FUNCTION private.player_leaderboard()
RETURNS TABLE (id uuid, display_name text, points integer, completed_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH completion_scores AS (
    SELECT user_id, coalesce(sum(points_awarded), 0)::integer as points, count(*)::integer as completed_count
    FROM public.completions WHERE status = 'confirmed' GROUP BY user_id
  ),
  progress_periods AS (
    SELECT entry.user_id, entry.challenge_id, entry.period_key, sum(entry.amount)::integer as progress
    FROM public.challenge_progress_entries entry GROUP BY entry.user_id, entry.challenge_id, entry.period_key
  ),
  progress_scores AS (
    SELECT period.user_id,
      coalesce(sum(
        CASE
          WHEN lower(challenge.title) LIKE '%pushup%' OR lower(challenge.title) LIKE '%push-up%' THEN
            (LEAST(period.progress, COALESCE(commitment.custom_target, challenge.tracking_target, 100) * 2) / 10)
          WHEN lower(challenge.title) = 'gym' THEN
            (LEAST(period.progress, COALESCE(commitment.custom_target, challenge.tracking_target, 4)) * 10) +
            (CASE WHEN period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 4) THEN 50 ELSE 0 END)
          ELSE
            coalesce(reward.points, 0)
        END
      ), 0)::integer as points,
      count(*) filter (where
        CASE
          WHEN lower(challenge.title) LIKE '%pushup%' OR lower(challenge.title) LIKE '%push-up%' THEN
            period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 100)
          WHEN lower(challenge.title) = 'gym' THEN
            period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 4)
          ELSE
            coalesce(reward.points, 0) > 0
        END
      )::integer as completed_count
    FROM progress_periods period
    JOIN public.challenges challenge ON challenge.id = period.challenge_id
    LEFT JOIN public.challenge_commitments commitment
      ON commitment.user_id = period.user_id AND commitment.challenge_id = challenge.id
    LEFT JOIN LATERAL (
      SELECT coalesce(max((tier->>'points')::integer), 0)::integer as points
      FROM jsonb_array_elements(challenge.reward_tiers) tier
      WHERE period.progress >= (tier->>'threshold')::integer
    ) reward ON true
    GROUP BY period.user_id
  )
  SELECT profile.id, profile.display_name,
    (coalesce(completion.points, 0) + coalesce(progress.points, 0))::integer as points,
    (coalesce(completion.completed_count, 0) + coalesce(progress.completed_count, 0))::integer as completed_count
  FROM public.profiles profile
  LEFT JOIN completion_scores completion ON completion.user_id = profile.id
  LEFT JOIN progress_scores progress ON progress.user_id = profile.id
  ORDER BY points desc, profile.display_name, profile.id;
$$;
