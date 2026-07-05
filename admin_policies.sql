-- Add admin RLS policies

-- challenges: allow admins to delete or update any challenge
DROP POLICY IF EXISTS "Admins can update all challenges" ON public.challenges;
CREATE POLICY "Admins can update all challenges" ON public.challenges FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "Admins can delete all challenges" ON public.challenges;
CREATE POLICY "Admins can delete all challenges" ON public.challenges FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- users: allow admins to view all users
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
CREATE POLICY "Admins can view all users" ON public.users FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);

-- submissions: allow admins to delete any submission
DROP POLICY IF EXISTS "Admins can delete all submissions" ON public.submissions;
CREATE POLICY "Admins can delete all submissions" ON public.submissions FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_admin = true)
);
