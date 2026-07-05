ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_points_earned_check;
ALTER TABLE public.submissions ADD CONSTRAINT submissions_points_earned_check CHECK (points_earned >= 0);
