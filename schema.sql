-- Supabase Schema for Daily Code Clash

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Users Table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT,
    avatar_url TEXT,
    total_score INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow users to read all users (needed for leaderboard)
CREATE POLICY "Users can view all users" ON public.users FOR SELECT USING (true);
-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
-- Trigger to automatically create a public.users row when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (new.id, new.email, split_part(new.email, '@', 1));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Create Point Settings Table (Global configuration)
CREATE TABLE IF NOT EXISTS public.point_settings (
    id SERIAL PRIMARY KEY,
    easy_points INTEGER DEFAULT 1,
    medium_points INTEGER DEFAULT 2,
    hard_points INTEGER DEFAULT 3,
    daily_target INTEGER DEFAULT 5,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Insert default row
INSERT INTO public.point_settings (id, easy_points, medium_points, hard_points, daily_target)
VALUES (1, 1, 2, 3, 5) ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.point_settings ENABLE ROW LEVEL SECURITY;
-- Everyone can read settings
CREATE POLICY "Anyone can read point settings" ON public.point_settings FOR SELECT USING (true);
-- Any authenticated user can update settings (since it's a 1v1 trusted app)
CREATE POLICY "Authenticated users can update settings" ON public.point_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- 3. Create Submissions Table (Logged problems)
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    problem_name TEXT NOT NULL,
    problem_url TEXT,
    difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')),
    points_earned INTEGER NOT NULL,
    solved_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enable RLS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
-- Everyone can read all submissions (for activity feed)
CREATE POLICY "Anyone can view submissions" ON public.submissions FOR SELECT USING (true);
-- Users can only insert their own submissions
CREATE POLICY "Users can insert their own submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Users can delete their own submissions
CREATE POLICY "Users can delete their own submissions" ON public.submissions FOR DELETE USING (auth.uid() = user_id);

-- 4. Create Daily Summaries View for easy dashboard querying
CREATE OR REPLACE VIEW public.daily_summaries AS
SELECT 
    user_id,
    solved_date as date,
    SUM(points_earned) as total_points,
    COUNT(id) as problems_solved
FROM public.submissions
GROUP BY user_id, solved_date;

-- Function to check if a user met the daily target
CREATE OR REPLACE FUNCTION public.check_daily_target_met(p_user_id UUID, p_date DATE)
RETURNS BOOLEAN AS $$
DECLARE
    v_total_points INTEGER;
    v_daily_target INTEGER;
BEGIN
    SELECT COALESCE(SUM(points_earned), 0) INTO v_total_points FROM public.submissions WHERE user_id = p_user_id AND solved_date = p_date;
    SELECT daily_target INTO v_daily_target FROM public.point_settings WHERE id = 1;
    RETURN v_total_points >= v_daily_target;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
