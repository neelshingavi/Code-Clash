begin;
select plan(2);

-- Insert a test user into auth.users to satisfy FK
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token) 
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'test@test.com', 'fakepassword', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '') ON CONFLICT DO NOTHING;

INSERT INTO public.users (id, email, username, leetcode_id) VALUES ('00000000-0000-0000-0000-000000000001', 'test@test.com', 'testuser', 'testuser') ON CONFLICT DO NOTHING;

-- Insert a challenge
INSERT INTO public.challenges (id, created_by, name, start_date, end_date, daily_target, penalty_mode, penalty_amount, easy_points, medium_points, hard_points)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Challenge', current_date - interval '2 days', current_date + interval '5 days', 5, 'minus_points', 5, 1, 3, 5) ON CONFLICT DO NOTHING;

-- Join participant with initial score 100
INSERT INTO public.challenge_participants (id, challenge_id, user_id, score, last_evaluated_date)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 100, current_date - interval '2 days') ON CONFLICT DO NOTHING;

-- Run sweep for yesterday
select public.run_daily_penalty_sweep();

-- Since the user had NO submissions yesterday, their score should drop by 5 and they should receive a penalty_event.
select is(
  (select score from public.challenge_participants where id = '00000000-0000-0000-0000-000000000003'),
  95,
  'minus_points penalty applied correctly for a missed day'
);

select is(
  (select count(*)::int from public.penalty_events where user_id = '00000000-0000-0000-0000-000000000001'),
  1,
  'exactly one penalty_event row is recorded'
);

select * from finish();
rollback;
