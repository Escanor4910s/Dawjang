-- Fix 1: Prevent users from self-updating plan and credits
-- Drop existing permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;

-- Recreate with column protection via trigger
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can change plan and credits
  IF (NEW.plan IS DISTINCT FROM OLD.plan OR NEW.credits IS DISTINCT FROM OLD.credits) THEN
    IF NOT public.is_admin() THEN
      NEW.plan := OLD.plan;
      NEW.credits := OLD.credits;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- Re-add the UPDATE policy
CREATE POLICY "Users can update own profile."
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Fix 2: Restrict gamification direct writes
-- Remove permissive UPDATE policy
DROP POLICY IF EXISTS "Users can update their own gamification data" ON public.user_gamification;
DROP POLICY IF EXISTS "Users can insert their own gamification data" ON public.user_gamification;

-- Create a secure increment function instead
CREATE OR REPLACE FUNCTION public.increment_user_xp(
  p_xp_amount integer,
  p_action_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_max_xp integer;
BEGIN
  -- Bound XP per action type
  v_max_xp := CASE p_action_type
    WHEN 'quiz_completed' THEN 50
    WHEN 'flashcard_reviewed' THEN 10
    WHEN 'course_uploaded' THEN 30
    WHEN 'streak_bonus' THEN 20
    ELSE 10
  END;

  -- Clamp to max allowed
  IF p_xp_amount > v_max_xp THEN
    p_xp_amount := v_max_xp;
  END IF;
  IF p_xp_amount < 0 THEN
    p_xp_amount := 0;
  END IF;

  UPDATE user_gamification
  SET xp = xp + p_xp_amount,
      level = GREATEST(1, (xp + p_xp_amount) / 500 + 1),
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Create a secure function to update streak and counters
CREATE OR REPLACE FUNCTION public.record_gamification_activity(
  p_action_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_activity date;
  v_current_streak integer;
BEGIN
  SELECT last_activity_date, current_streak INTO v_last_activity, v_current_streak
  FROM user_gamification WHERE user_id = auth.uid();

  IF v_last_activity = CURRENT_DATE THEN
    -- Already recorded today, just update counters
    NULL;
  ELSIF v_last_activity = CURRENT_DATE - 1 THEN
    v_current_streak := v_current_streak + 1;
  ELSE
    v_current_streak := 1;
  END IF;

  UPDATE user_gamification
  SET last_activity_date = CURRENT_DATE,
      current_streak = v_current_streak,
      longest_streak = GREATEST(longest_streak, v_current_streak),
      total_quizzes_completed = CASE WHEN p_action_type = 'quiz_completed' THEN total_quizzes_completed + 1 ELSE total_quizzes_completed END,
      total_flashcards_reviewed = CASE WHEN p_action_type = 'flashcard_reviewed' THEN total_flashcards_reviewed + 1 ELSE total_flashcards_reviewed END,
      updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- Grant execute to authenticated only
REVOKE EXECUTE ON FUNCTION public.increment_user_xp FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_user_xp TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_gamification_activity FROM anon;
GRANT EXECUTE ON FUNCTION public.record_gamification_activity TO authenticated;