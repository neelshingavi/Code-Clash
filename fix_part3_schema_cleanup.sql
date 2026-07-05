-- Fix 3.6 Dead / duplicated state: two "rank" fields, two "target" fields

-- Drop the unused global_rank column from users
ALTER TABLE public.users DROP COLUMN IF EXISTS global_rank;

-- Drop the point_settings table completely as it is superseded by challenge-level point configurations
DROP TABLE IF EXISTS public.point_settings;
