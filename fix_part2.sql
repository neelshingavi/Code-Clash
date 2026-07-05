-- Fixes for Part 2 (Section 4 Security Audit)

-- 4.1 RLS: Drop UPDATE policy on challenge_participants
DROP POLICY IF EXISTS "Participants can update" ON public.challenge_participants;

-- 4.3 Client-controlled points: trivial score forgery
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS points_earned_positive;
ALTER TABLE public.submissions ADD CONSTRAINT points_earned_positive CHECK (points_earned > 0);

ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS unique_problem_per_user_per_day;
ALTER TABLE public.submissions ADD CONSTRAINT unique_problem_per_user_per_day UNIQUE (user_id, challenge_id, problem_url, solved_date);

-- 4.4 Email enumeration
DROP FUNCTION IF EXISTS public.get_email_by_username(TEXT);

-- 4.5 PII Leak: Users table world-readable
DROP POLICY IF EXISTS "Users can view all users" ON public.users;
CREATE POLICY "Users can view own row" ON public.users FOR SELECT USING (auth.uid() = id);

-- Create public view
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, username, leetcode_id, avatar_url, total_score, current_streak, created_at
  FROM public.users;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 4.6 Username collisions break login
-- Drop duplicates just in case (we shouldn't have any on a fresh dev db)
CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON public.users (LOWER(username));

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS username_format;
ALTER TABLE public.users ADD CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]{3,20}$');
