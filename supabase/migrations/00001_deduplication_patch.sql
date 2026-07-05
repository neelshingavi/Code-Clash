-- ============================================================================
-- 00001_deduplication_patch.sql 
-- Cleans up existing duplicates and enforces strict UNIQUE constraints
-- ============================================================================

-- 1. Deduplicate existing rows (keeps the oldest submission for each problem)
DELETE FROM public.submissions T1
USING public.submissions T2
WHERE T1.ctid > T2.ctid
  AND T1.user_id = T2.user_id
  AND T1.problem_url = T2.problem_url
  -- Match NULL challenge_ids together, or match explicit challenge_ids
  AND (
    (T1.challenge_id IS NULL AND T2.challenge_id IS NULL)
    OR (T1.challenge_id = T2.challenge_id)
  );

-- 2. Drop the old flawed constraint
ALTER TABLE public.submissions 
DROP CONSTRAINT IF EXISTS unique_problem_per_user_per_day;

-- 3. Add the strict constraint (removes solved_date to prevent re-submission exploits)
ALTER TABLE public.submissions 
ADD CONSTRAINT unique_problem_per_user_per_day UNIQUE (user_id, challenge_id, problem_url);

-- 4. Create Partial Index to patch PostgreSQL's NULL evaluation behavior
-- This ensures personal logs (challenge_id = NULL) cannot be duplicated
CREATE UNIQUE INDEX IF NOT EXISTS unique_personal_log 
ON public.submissions (user_id, problem_url) 
WHERE challenge_id IS NULL;
