-- Fix 1: Restrict profiles SELECT to owner + admin (remove public read)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());

-- Fix 2: Add missing UPDATE policy on courses
CREATE POLICY "Users can update their own courses"
ON public.courses FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fix 3: Restrict leaderboard to authenticated users only
REVOKE EXECUTE ON FUNCTION public.get_leaderboard FROM anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard TO authenticated;