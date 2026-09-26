-- ====================================================================
-- WINTER ARC 2026: PULLUPS + WATER SCORING
-- Extends the existing scoring_profile mechanism to two more challenges.
-- Gym, pushups and standard scoring are untouched.
--
-- Pullups: pick 8 or 20. Base pay is 5 XP for the 8 pick and 12 XP for the
--          20 pick, earned proportionally, with a ceiling of double the pick.
--          Every 8 pullups = 5 XP (light) / every 5 pullups = 3 XP (heavy).
-- Water:  fixed 2.5L target, 4L hard ceiling, 1 XP per 250ml.
--
-- NOTE: this migration must sort AFTER 20260925202554_repeatable_season_challenges.sql
-- because that one recreates player_challenges. The definitions below are based
-- on its version (catalog_id column, commitment-first join) plus the new profiles.
-- ====================================================================

-- 1. ALLOW THE TWO NEW PROFILES
ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_scoring_profile_check,
  ADD CONSTRAINT challenges_scoring_profile_check
    CHECK (scoring_profile IN ('gym', 'pushups', 'pullups', 'water', 'standard'));

-- 2. PULLUPS: MEASURED TASK, PICKER OF 8 OR 20, CEILING OF DOUBLE THE PICK
--    Entry rules mirror pushups: any whole amount, no cooldown.
UPDATE public.challenges
SET scoring_profile = 'pullups',
    tracking_mode = 'quantity',
    tracking_unit = 'reps',
    tracking_target = 20,
    entry_step = null,
    burst_limit = 1,
    minimum_interval_minutes = 0,
    reward_tiers = '[]'::jsonb,
    points = 12
WHERE frequency = 'daily'
  AND lower(title) IN ('20 pullups', '20 pull-ups', 'pullups', 'pull-ups');

-- 3. WATER: FIXED 2.5L TARGET, 4L CEILING, 1 XP PER 250ML
--    Entry rules are deliberately unchanged: 250ml step, 3 per burst, 30 min cooldown.
UPDATE public.challenges
SET scoring_profile = 'water',
    tracking_unit = 'ml',
    tracking_target = 2500,
    points = 10
WHERE frequency = 'daily'
  AND lower(title) IN ('2.5l water', '2.5l water per day', 'hydration protocol');

-- 4. RECORD_CHALLENGE_PROGRESS: CEILING FROM THE PROFILE
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

  SELECT custom_target INTO user_target
  FROM public.challenge_commitments
  WHERE user_id = caller_id AND challenge_id = target_challenge_id;

  effective_target := COALESCE(user_target, target.tracking_target, 1);

  IF target.scoring_profile IN ('pushups', 'pullups') THEN
    max_progress_limit := effective_target * 2;
  ELSIF target.scoring_profile = 'water' THEN
    max_progress_limit := 4000;
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

-- 5. PLAYER_CHALLENGES: SCORE THE TWO NEW PROFILES
DROP FUNCTION IF EXISTS public.player_challenges(text);
DROP FUNCTION IF EXISTS private.player_challenges(text);

CREATE FUNCTION private.player_challenges(target_period_key text)
RETURNS TABLE (
  id uuid, catalog_id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb, scoring_profile text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := (SELECT auth.uid());
  requested_date date := private.valid_local_period(target_period_key);
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required' USING errcode = '28000'; END IF;

  RETURN QUERY
  SELECT
    CASE WHEN challenge.frequency = 'once' THEN commitment.id ELSE challenge.id END,
    challenge.id,
    challenge.title,
    challenge.description,
    challenge.frequency,
    CASE
      WHEN challenge.scoring_profile = 'gym' THEN
        (COALESCE(commitment.custom_target, challenge.tracking_target, 4) * 10) + 50
      WHEN challenge.scoring_profile = 'pushups' THEN
        (COALESCE(commitment.custom_target, challenge.tracking_target, 100) / 10)
      WHEN challenge.scoring_profile = 'pullups' THEN
        (CASE WHEN COALESCE(commitment.custom_target, challenge.tracking_target, 20) >= 20 THEN 12 ELSE 5 END)
      WHEN challenge.scoring_profile = 'water' THEN
        (COALESCE(commitment.custom_target, challenge.tracking_target, 2500) / 250)
      ELSE challenge.points
    END,
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
    COALESCE(commitment.custom_target, challenge.tracking_target),
    challenge.entry_options,
    challenge.entry_step,
    challenge.burst_limit,
    challenge.minimum_interval_minutes,
    challenge.attempt_duration_minutes,
    challenge.reward_tiers,
    entry_state.total,
    CASE
      WHEN challenge.scoring_profile = 'pushups' THEN
        (LEAST(entry_state.total, COALESCE(commitment.custom_target, challenge.tracking_target, 100) * 2) / 10)
      WHEN challenge.scoring_profile = 'pullups' THEN
        (LEAST(entry_state.total, COALESCE(commitment.custom_target, challenge.tracking_target, 20) * 2)
          * (CASE WHEN COALESCE(commitment.custom_target, challenge.tracking_target, 20) >= 20 THEN 12 ELSE 5 END))
        / COALESCE(commitment.custom_target, challenge.tracking_target, 20)
      WHEN challenge.scoring_profile = 'water' THEN
        (LEAST(entry_state.total, 4000) / 250)
      WHEN challenge.scoring_profile = 'gym' THEN
        (LEAST(entry_state.total, COALESCE(commitment.custom_target, challenge.tracking_target, 4)) * 10)
        + (CASE WHEN entry_state.total >= COALESCE(commitment.custom_target, challenge.tracking_target, 4) THEN 50 ELSE 0 END)
      ELSE
        COALESCE((
          SELECT max((tier->>'points')::integer)
          FROM jsonb_array_elements(challenge.reward_tiers) tier
          WHERE entry_state.total >= (tier->>'threshold')::integer
        ), 0)
    END,
    CASE
      WHEN entry_state.latest IS NOT NULL AND entry_state.entry_count % challenge.burst_limit = 0
      THEN entry_state.latest + make_interval(mins => challenge.minimum_interval_minutes)
      ELSE NULL
    END,
    CASE
      WHEN entry_state.first_entry IS NOT NULL
        AND challenge.attempt_duration_minutes IS NOT NULL
        AND entry_state.total < COALESCE(commitment.custom_target, challenge.tracking_target)
      THEN entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes)
      ELSE NULL
    END,
    CASE
      WHEN entry_state.first_entry IS NOT NULL
        AND challenge.attempt_duration_minutes IS NOT NULL
        AND entry_state.total < COALESCE(commitment.custom_target, challenge.tracking_target)
        AND now() >= entry_state.first_entry + make_interval(mins => challenge.attempt_duration_minutes)
      THEN true
      ELSE false
    END,
    entry_state.entries,
    challenge.scoring_profile
  FROM public.challenge_commitments commitment
  JOIN public.challenges challenge
    ON challenge.id = commitment.challenge_id
  LEFT JOIN public.completions completion
    ON completion.commitment_id = commitment.id
    AND completion.status <> 'reversed'
    AND completion.period_key = CASE challenge.frequency
      WHEN 'daily' THEN target_period_key
      WHEN 'weekly' THEN to_char(requested_date, 'IYYY-"W"IW')
      ELSE '2026-season'
    END
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(sum(item.amount), 0)::integer AS total,
      min(item.recorded_at) AS first_entry,
      max(item.recorded_at) AS latest,
      count(item.id)::integer AS entry_count,
      COALESCE(
        jsonb_agg(
          jsonb_build_object('id', item.id, 'amount', item.amount, 'recordedAt', item.recorded_at)
          ORDER BY item.recorded_at
        ) FILTER (WHERE item.id IS NOT NULL),
        '[]'::jsonb
      ) AS entries
    FROM public.challenge_progress_entries item
    WHERE item.user_id = caller_id
      AND item.challenge_id = challenge.id
      AND item.period_key = CASE challenge.frequency
        WHEN 'daily' THEN target_period_key
        WHEN 'weekly' THEN to_char(requested_date, 'IYYY-"W"IW')
        ELSE '2026-season'
      END
  ) entry_state ON true
  WHERE commitment.user_id = caller_id
    AND challenge.archived_at IS NULL
    AND requested_date BETWEEN challenge.starts_on AND challenge.ends_on
  ORDER BY challenge.points, commitment.committed_at, commitment.id;
END;
$$;

CREATE FUNCTION public.player_challenges(target_period_key text)
RETURNS TABLE (
  id uuid, catalog_id uuid, title text, description text, frequency public.challenge_frequency, points integer,
  requires_approval boolean, starts_on date, ends_on date, archived_at timestamptz,
  completion_id uuid, completion_period_key text, completion_points_awarded integer,
  completion_status public.completion_status, completion_completed_at timestamptz,
  tracking_mode text, tracking_unit text, tracking_target integer, entry_options integer[],
  entry_step integer, burst_limit integer, minimum_interval_minutes integer, attempt_duration_minutes integer,
  reward_tiers jsonb, progress integer, secured_points integer, cooldown_ends_at timestamptz,
  attempt_ends_at timestamptz, attempt_failed boolean, progress_entries jsonb, scoring_profile text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$ select * from private.player_challenges(target_period_key) $$;

REVOKE EXECUTE ON FUNCTION private.player_challenges(text), public.player_challenges(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION private.player_challenges(text), public.player_challenges(text) TO authenticated;

-- 6. PLAYER_LEADERBOARD: SAME TWO NEW PROFILES
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
          WHEN challenge.scoring_profile = 'pushups' THEN
            (LEAST(period.progress, COALESCE(commitment.custom_target, challenge.tracking_target, 100) * 2) / 10)
          WHEN challenge.scoring_profile = 'pullups' THEN
            (LEAST(period.progress, COALESCE(commitment.custom_target, challenge.tracking_target, 20) * 2)
              * (CASE WHEN COALESCE(commitment.custom_target, challenge.tracking_target, 20) >= 20 THEN 12 ELSE 5 END))
            / COALESCE(commitment.custom_target, challenge.tracking_target, 20)
          WHEN challenge.scoring_profile = 'water' THEN
            (LEAST(period.progress, 4000) / 250)
          WHEN challenge.scoring_profile = 'gym' THEN
            (LEAST(period.progress, COALESCE(commitment.custom_target, challenge.tracking_target, 4)) * 10) +
            (CASE WHEN period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 4) THEN 50 ELSE 0 END)
          ELSE
            coalesce(reward.points, 0)
        END
      ), 0)::integer as points,
      count(*) filter (where
        CASE
          WHEN challenge.scoring_profile = 'pushups' THEN
            period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 100)
          WHEN challenge.scoring_profile = 'pullups' THEN
            period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 20)
          WHEN challenge.scoring_profile = 'water' THEN
            period.progress >= COALESCE(commitment.custom_target, challenge.tracking_target, 2500)
          WHEN challenge.scoring_profile = 'gym' THEN
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
