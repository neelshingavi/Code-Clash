CREATE TABLE IF NOT EXISTS public.penalty_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
    penalty_date DATE NOT NULL DEFAULT CURRENT_DATE,
    penalty_type TEXT NOT NULL,
    penalty_amount INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, challenge_id, penalty_date)
);

ALTER TABLE public.penalty_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own penalties" ON public.penalty_events FOR SELECT USING (auth.uid() = user_id);

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
  v_missed boolean;
BEGIN
  -- We'll track who met at least one quota and who didn't.
  -- A simple way: just reset streaks for anyone who missed a quota, 
  -- and increment streaks for anyone who met all quotas.
  -- Wait, the spec says: "increment current_streak for a user on any day they meet at least one challenge's target, reset to 0 on a missed day with no verified submissions at all."
  
  -- Step 1: Reset streaks to 0 for users who had NO verified submissions yesterday.
  UPDATE public.users u
  SET current_streak = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.user_id = u.id AND s.solved_date = v_yesterday AND s.verified = true
  );

  -- Step 2: Increment streak by 1 for users who met AT LEAST ONE challenge target yesterday
  -- Wait, the spec says "meet at least one challenge's target".
  UPDATE public.users u
  SET current_streak = COALESCE(current_streak, 0) + 1
  WHERE EXISTS (
    SELECT 1
    FROM public.challenge_participants cp
    JOIN public.challenges c ON cp.challenge_id = c.id
    WHERE cp.user_id = u.id
      AND c.start_date <= v_yesterday AND c.end_date >= v_yesterday
      AND (
        SELECT COALESCE(SUM(points_earned), 0)
        FROM public.submissions s
        WHERE s.challenge_id = cp.challenge_id 
          AND s.user_id = cp.user_id 
          AND s.solved_date = v_yesterday
          AND s.verified = true
      ) >= COALESCE(cp.temporary_quota, c.daily_target)
  );

  -- Step 3: Evaluate penalties for all active participants
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
      AND solved_date = v_yesterday
      AND verified = true;
      
    -- If they failed to meet the quota
    IF v_yesterday_points < v_quota THEN
      
      -- Insert into penalty_events
      INSERT INTO public.penalty_events (user_id, challenge_id, penalty_date, penalty_type, penalty_amount)
      VALUES (v_participant.user_id, v_participant.challenge_id, v_today, v_participant.penalty_mode, v_participant.penalty_amount)
      ON CONFLICT DO NOTHING;

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
