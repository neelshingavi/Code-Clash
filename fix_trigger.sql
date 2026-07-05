-- Fix for 4.6 (Username collisions) / Missed Trigger Update
-- Update the trigger to actually use the raw_user_meta_data for username and leetcode_id
-- and catch unique_violation cleanly.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, username, leetcode_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'leetcode_id'
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- If the user enters a username that already exists, bubble up a clean error
    RAISE EXCEPTION 'username_taken' USING errcode = '23505';
END;
$$;
