-- Supabase Schema V3 for Username Authentication

-- 1. Create a secure function to lookup email by username
-- This allows the frontend to log in a user by their username by first fetching their hidden email.
CREATE OR REPLACE FUNCTION public.get_email_by_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as the definer (postgres) to bypass RLS
AS $$
DECLARE
    v_email TEXT;
BEGIN
    SELECT email INTO v_email 
    FROM public.users 
    WHERE LOWER(username) = LOWER(p_username)
    LIMIT 1;
    
    RETURN v_email;
END;
$$;

-- Allow authenticated and anon users to call this function (needed for login)
GRANT EXECUTE ON FUNCTION public.get_email_by_username(TEXT) TO anon, authenticated;
