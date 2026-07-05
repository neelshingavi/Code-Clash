-- Fix 3.4 Penalty Evaluation runs on the wrong side of the network
-- Move penalty logic entirely to a server-side RPC that can be called via CRON
CREATE OR REPLACE FUNCTION public.run_daily_penalty_sweep()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_today date := current_date;
  v_yesterday date := current_date - interval '1 day';
  v_yesterday_points integer;
  v_quota integer;
BEGIN
  -- Loop through all active participants
  FOR v_participant IN 
    SELECT cp.id, cp.challenge_id, cp.user_id, cp.score, cp.temporary_quota, cp.last_evaluated_date, c.daily_target, c.penalty_mode, c.penalty_amount
    FROM public.challenge_participants cp
    JOIN public.challenges c ON cp.challenge_id = c.id
    WHERE c.start_date <= v_today AND c.end_date >= v_today
      AND cp.last_evaluated_date < v_today
  LOOP
    
    -- Determine what they needed to solve yesterday
    v_quota := COALESCE(v_participant.temporary_quota, v_participant.daily_target);
    
    -- Check how many points they actually got yesterday
    SELECT COALESCE(SUM(points_earned), 0) INTO v_yesterday_points
    FROM public.submissions
    WHERE challenge_id = v_participant.challenge_id 
      AND user_id = v_participant.user_id 
      AND solved_date = v_yesterday;
      
    -- If they failed to meet the quota
    IF v_yesterday_points < v_quota THEN
      
      IF v_participant.penalty_mode = 'minus_points' THEN
        UPDATE public.challenge_participants 
        SET score = score - v_participant.penalty_amount,
            last_evaluated_date = v_today,
            temporary_quota = NULL
        WHERE id = v_participant.id;
        
      ELSIF v_participant.penalty_mode = 'double_quota_next_day' THEN
        UPDATE public.challenge_participants 
        SET temporary_quota = v_quota * 2,
            last_evaluated_date = v_today
        WHERE id = v_participant.id;
        
      -- Handle other penalty modes here...
      ELSE
        UPDATE public.challenge_participants 
        SET last_evaluated_date = v_today,
            temporary_quota = NULL
        WHERE id = v_participant.id;
      END IF;
      
    ELSE
      -- They met the quota, clear any temporary penalties
      UPDATE public.challenge_participants 
      SET last_evaluated_date = v_today,
          temporary_quota = NULL
      WHERE id = v_participant.id;
    END IF;
    
  END LOOP;
END;
$$;
