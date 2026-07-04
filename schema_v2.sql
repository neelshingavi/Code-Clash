-- Supabase Schema V2 for Advanced Code Clash

-- (Assuming V1 tables are still there, we alter them or create new ones)

-- 1. Update Users Table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS leetcode_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS global_rank TEXT DEFAULT 'Bronze';

-- Ensure handle_new_user captures raw_user_meta_data for the new fields
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, leetcode_id)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'leetcode_id'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Challenges Table
CREATE TYPE penalty_type AS ENUM ('none', 'minus_points', 'double_quota_next_day', 'rank_reduction', 'streak_reset');

CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    daily_target INTEGER DEFAULT 5,
    penalty_mode penalty_type DEFAULT 'minus_points',
    penalty_amount INTEGER DEFAULT 5,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view challenges" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create challenges" ON public.challenges FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 3. Challenge Participants
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    rank TEXT DEFAULT 'Novice',
    temporary_quota INTEGER DEFAULT NULL,
    last_evaluated_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE(challenge_id, user_id)
);
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view participants" ON public.challenge_participants FOR SELECT USING (true);
CREATE POLICY "Users can join challenges" ON public.challenge_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
-- In a real app we'd restrict UPDATE, but for this client-side 1v1 we allow participants to update
CREATE POLICY "Participants can update" ON public.challenge_participants FOR UPDATE USING (auth.role() = 'authenticated');

-- 4. Update Submissions
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE;

-- Enable Realtime for leaderboards
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants;
