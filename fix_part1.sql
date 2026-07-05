-- Fixes for Part 1 (Section 3 of the Audit)

-- Fix 3.6: Remove point_settings and users.global_rank
DROP TABLE IF EXISTS public.point_settings;

ALTER TABLE public.users DROP COLUMN IF EXISTS global_rank;

-- Add point configuration directly to challenges
ALTER TABLE public.challenges 
  ADD COLUMN IF NOT EXISTS easy_points integer not null default 1 check (easy_points >= 0),
  ADD COLUMN IF NOT EXISTS medium_points integer not null default 2 check (medium_points >= 0),
  ADD COLUMN IF NOT EXISTS hard_points integer not null default 3 check (hard_points >= 0);

-- Fix 3.1, 3.2, 3.3: Atomic sync function for LeetCode Auto-Sync
-- This prevents race conditions and ensures score only goes up accurately
CREATE OR REPLACE FUNCTION public.sync_leetcode_solution(
  p_challenge_id uuid,
  p_solves_today integer,
  p_today_str date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_points integer;
  v_points_to_award integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Lock the participant row to prevent concurrent race conditions
  PERFORM 1 FROM public.challenge_participants 
  WHERE challenge_id = p_challenge_id AND user_id = v_user_id 
  FOR UPDATE;

  -- Check existing submission for today
  SELECT points_earned INTO v_existing_points
  FROM public.submissions
  WHERE challenge_id = p_challenge_id 
    AND user_id = v_user_id 
    AND solved_date = p_today_str;

  IF v_existing_points IS NOT NULL THEN
    IF v_existing_points >= p_solves_today THEN
      RETURN; -- Already synced or has more points
    END IF;
    
    v_points_to_award := p_solves_today - v_existing_points;
    
    UPDATE public.submissions 
    SET points_earned = p_solves_today,
        problem_name = 'LeetCode Sync (' || p_solves_today || ' solves)'
    WHERE challenge_id = p_challenge_id 
      AND user_id = v_user_id 
      AND solved_date = p_today_str;
  ELSE
    v_points_to_award := p_solves_today;
    
    INSERT INTO public.submissions (
      user_id, challenge_id, problem_name, problem_url, difficulty, points_earned, solved_date
    ) VALUES (
      v_user_id, p_challenge_id, 'LeetCode Sync (' || p_solves_today || ' solves)', 'https://leetcode.com', 'easy', p_solves_today, p_today_str
    );
  END IF;

  -- Atomically increment scores
  UPDATE public.challenge_participants 
  SET score = score + v_points_to_award
  WHERE challenge_id = p_challenge_id AND user_id = v_user_id;

  UPDATE public.users 
  SET total_score = total_score + v_points_to_award
  WHERE id = v_user_id;

END;
$$;
