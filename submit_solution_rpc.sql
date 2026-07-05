-- Create submit_solution RPC for manual submission verification (Audit 5.4)
CREATE OR REPLACE FUNCTION public.submit_solution(
  p_challenge_id UUID,
  p_problem_name TEXT,
  p_problem_url TEXT,
  p_difficulty TEXT,
  p_verified BOOLEAN
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Determine points based on challenge rules
  SELECT 
    CASE p_difficulty
      WHEN 'easy' THEN easy_points
      WHEN 'medium' THEN medium_points
      WHEN 'hard' THEN hard_points
      ELSE 0
    END INTO v_points
  FROM public.challenges
  WHERE id = p_challenge_id;

  -- Insert the submission
  INSERT INTO public.submissions (
    challenge_id, user_id, problem_name, problem_url, difficulty, points_earned, verified
  ) VALUES (
    p_challenge_id, v_user_id, p_problem_name, p_problem_url, p_difficulty, v_points, p_verified
  );

  -- Update score if verified
  IF p_verified THEN
    UPDATE public.challenge_participants
    SET score = score + v_points
    WHERE challenge_id = p_challenge_id AND user_id = v_user_id;

    -- Update global total_score (Fixes Section 3.3 Race Condition)
    UPDATE public.users
    SET total_score = total_score + v_points
    WHERE id = v_user_id;
  END IF;
END;
$$;
