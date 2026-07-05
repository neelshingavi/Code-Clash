-- ============================================================================
-- 00000_master_schema.sql — Code Clash Consolidated Schema v2
-- Production Grade. Clean State. No Mitigations.
-- ============================================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "pg_cron" with schema extensions;

-- ----------------------------------------------------------------------------
-- CLEAN DATA AND DROP EXISTING SCHEMA (Safely)
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.submit_solution(UUID, TEXT, TEXT, TEXT, BOOLEAN, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.submit_solution(UUID, TEXT, TEXT, TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.run_daily_penalty_sweep() CASCADE;

DROP VIEW IF EXISTS public.public_profiles CASCADE;

-- Drop tables carefully (Order matters due to foreign keys)
DROP TABLE IF EXISTS public.penalty_events CASCADE;
DROP TABLE IF EXISTS public.submissions CASCADE;
DROP TABLE IF EXISTS public.challenge_participants CASCADE;
DROP TABLE IF EXISTS public.challenges CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP TYPE IF EXISTS public.penalty_type CASCADE;

-- ----------------------------------------------------------------------------
-- TYPES
-- ----------------------------------------------------------------------------
create type public.penalty_type as enum (
  'none', 
  'minus_points', 
  'double_quota_next_day', 
  'rank_reduction', 
  'streak_reset'
);

-- ----------------------------------------------------------------------------
-- users: public profile row, 1:1 with auth.users
-- ----------------------------------------------------------------------------
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  username        text not null,
  leetcode_id     text,
  avatar_url      text,
  total_score     integer not null default 0,
  current_streak  integer not null default 0,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default timezone('utc', now())
);

-- Case-insensitive uniqueness + format validation
create unique index users_username_unique_idx on public.users (lower(username));
alter table public.users add constraint username_format
  check (username ~ '^[a-zA-Z0-9_]{3,20}$');

alter table public.users enable row level security;

-- Only the owner can read their own row (this table now carries email — PII)
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.users where id = auth.uid()));

-- Public-safe leaderboard/profile view (no email exposed)
create view public.public_profiles as
  select id, username, leetcode_id, avatar_url, total_score, current_streak, created_at
  from public.users;
grant select on public.public_profiles to anon, authenticated;

-- Auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, username, leetcode_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'leetcode_id'
  );
  return new;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ----------------------------------------------------------------------------
-- challenges: single source of truth for rules
-- ----------------------------------------------------------------------------
create table public.challenges (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null check (char_length(name) between 3 and 80),
  start_date      date not null,
  end_date        date not null,
  daily_target    integer not null default 5 check (daily_target > 0),
  easy_points     integer not null default 1 check (easy_points >= 0),
  medium_points   integer not null default 2 check (medium_points >= 0),
  hard_points     integer not null default 3 check (hard_points >= 0),
  penalty_mode    public.penalty_type not null default 'minus_points',
  penalty_amount  integer not null default 5 check (penalty_amount >= 0),
  created_by      uuid not null references public.users(id),
  created_at      timestamptz not null default timezone('utc', now()),
  constraint end_after_start check (end_date > start_date)
);

alter table public.challenges enable row level security;
create policy "challenges_select_all" on public.challenges for select using (true);
create policy "challenges_insert_own" on public.challenges
  for insert with check (auth.uid() = created_by);
create policy "challenges_update_own_before_start" on public.challenges
  for update using (auth.uid() = created_by and start_date > current_date);

-- ----------------------------------------------------------------------------
-- challenge_participants: score/rank are NEVER client-writable
-- ----------------------------------------------------------------------------
create table public.challenge_participants (
  id                    uuid primary key default uuid_generate_v4(),
  challenge_id          uuid not null references public.challenges(id) on delete cascade,
  user_id               uuid not null references public.users(id) on delete cascade,
  score                 integer not null default 0,
  rank                  text not null default 'Novice',
  temporary_quota       integer,
  last_evaluated_date   date not null default current_date,
  created_at            timestamptz not null default timezone('utc', now()),
  unique (challenge_id, user_id)
);

alter table public.challenge_participants enable row level security;
create policy "participants_select_all" on public.challenge_participants for select using (true);
create policy "participants_insert_self" on public.challenge_participants
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.challenges c
      where c.id = challenge_id and current_date <= c.end_date
    )
  );
-- Deliberately: NO client-side UPDATE policy. Score/rank only change via RPC.

-- ----------------------------------------------------------------------------
-- submissions: anti-cheat ready, user + date unique constraint
-- ----------------------------------------------------------------------------
create table public.submissions (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  challenge_id    uuid references public.challenges(id) on delete cascade,
  problem_name    text not null check (char_length(problem_name) between 1 and 200),
  problem_url     text not null check (problem_url ~ '^https://leetcode\.com/problems/'),
  difficulty      text not null check (difficulty in ('easy', 'medium', 'hard')),
  points_earned   integer not null check (points_earned > 0),
  verified        boolean not null default false,
  solved_date     date not null default current_date,
  created_at      timestamptz not null default timezone('utc', now()),
  constraint unique_problem_per_user_per_day
    unique (user_id, challenge_id, problem_url)
);

create unique index unique_personal_log on public.submissions (user_id, problem_url) where challenge_id is null;

create index submissions_challenge_user_date_idx on public.submissions (challenge_id, user_id, solved_date);
create index submissions_user_date_idx on public.submissions (user_id, solved_date);

alter table public.submissions enable row level security;
create policy "submissions_select_all" on public.submissions for select using (true);
create policy "submissions_insert_self_personal_log_only" on public.submissions
  for insert with check (auth.uid() = user_id and challenge_id is null);
create policy "submissions_delete_own" on public.submissions
  for delete using (auth.uid() = user_id);

-- Trigger to autonomously update global total_score
CREATE OR REPLACE FUNCTION public.trg_update_global_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this problem_url has NOT been solved by this user before globally
  IF NOT EXISTS (
    SELECT 1 FROM public.submissions 
    WHERE user_id = NEW.user_id 
      AND problem_url = NEW.problem_url 
      AND id != NEW.id
  ) THEN
    UPDATE public.users
    SET total_score = total_score + NEW.points_earned
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_global_score_trigger ON public.submissions;
CREATE TRIGGER update_global_score_trigger
AFTER INSERT ON public.submissions
FOR EACH ROW EXECUTE PROCEDURE public.trg_update_global_score();

-- ----------------------------------------------------------------------------
-- penalty_events: durable audit trail
-- ----------------------------------------------------------------------------
create table public.penalty_events (
  id              uuid primary key default uuid_generate_v4(),
  challenge_id    uuid not null references public.challenges(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  penalty_date    date not null default current_date,
  penalty_type    text not null,
  penalty_amount  integer not null default 0,
  score_delta     integer not null default 0,
  details         jsonb,
  created_at      timestamptz not null default timezone('utc', now()),
  unique (challenge_id, user_id, penalty_date)
);

alter table public.penalty_events enable row level security;
create policy "penalty_events_select_own" on public.penalty_events
  for select using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- FUNCTIONS
-- ----------------------------------------------------------------------------

-- submit_solution: Logs submission accurately against historical dates
CREATE OR REPLACE FUNCTION public.submit_solution(
  p_challenge_id UUID,
  p_problem_name TEXT,
  p_problem_url TEXT,
  p_difficulty TEXT,
  p_verified BOOLEAN,
  p_solved_date DATE DEFAULT CURRENT_DATE
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points integer;
  v_user_id UUID;
  v_submission_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT 
    CASE p_difficulty
      WHEN 'easy' THEN easy_points
      WHEN 'medium' THEN medium_points
      WHEN 'hard' THEN hard_points
      ELSE 0
    END INTO v_points
  FROM public.challenges
  WHERE id = p_challenge_id;

  INSERT INTO public.submissions (
    challenge_id, user_id, problem_name, problem_url, difficulty, points_earned, verified, solved_date
  ) VALUES (
    p_challenge_id, v_user_id, p_problem_name, p_problem_url, p_difficulty, v_points, p_verified, p_solved_date
  )
  ON CONFLICT ON CONSTRAINT unique_problem_per_user_per_day DO NOTHING
  RETURNING id INTO v_submission_id;

  IF v_submission_id IS NULL THEN
    -- It was a duplicate for this specific challenge on this specific day.
    RETURN false;
  END IF;

  IF p_verified THEN
    UPDATE public.challenge_participants
    SET score = score + v_points
    WHERE challenge_id = p_challenge_id AND user_id = v_user_id;
    
    -- Note: We no longer manually update users.total_score here! 
    -- The trg_update_global_score Postgres Trigger handles it autonomously.
  END IF;
  
  RETURN true;
END;
$$;

-- run_daily_penalty_sweep: Evaluates streaks and quotas
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
  -- Step 1: Reset streaks to 0 for users who had NO verified submissions yesterday.
  UPDATE public.users u
  SET current_streak = 0
  WHERE NOT EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.user_id = u.id AND s.solved_date = v_yesterday AND s.verified = true
  );

  -- Step 2: Increment streak by 1 for users who met AT LEAST ONE challenge target yesterday
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
    
    v_quota := COALESCE(v_participant.temporary_quota, v_participant.daily_target);
    
    SELECT COALESCE(SUM(points_earned), 0) INTO v_yesterday_points
    FROM public.submissions
    WHERE challenge_id = v_participant.challenge_id 
      AND user_id = v_participant.user_id 
      AND solved_date = v_yesterday
      AND verified = true;
      
    IF v_yesterday_points < v_quota THEN
      
      INSERT INTO public.penalty_events (user_id, challenge_id, penalty_date, penalty_type, penalty_amount)
      VALUES (v_participant.user_id, v_participant.challenge_id, v_today, v_participant.penalty_mode::text, v_participant.penalty_amount)
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
      UPDATE public.challenge_participants 
      SET last_evaluated_date = v_today,
          temporary_quota = NULL
      WHERE id = v_participant.id;
    END IF;
    
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- REALTIME
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.submissions;
alter publication supabase_realtime add table public.challenge_participants;

-- ----------------------------------------------------------------------------
-- CRON SCHEDULING
-- ----------------------------------------------------------------------------
-- Schedule the penalty sweep to run every day at midnight (UTC)
SELECT cron.schedule(
  'daily-penalty-sweep',
  '0 0 * * *',
  $$ SELECT public.run_daily_penalty_sweep(); $$
);
